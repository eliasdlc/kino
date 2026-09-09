import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { actorDe, boundPayload, PAYLOAD_MAX_BYTES, PRUNE_BATCH, recordEvent, RETENTION_DAYS } from './eventLog';
import { MCP_TOKEN_ISSUER } from './lib/mcpToken';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const bob = { subject: 'user_bob', email: 'bob@usekino.dev', name: 'Bob' };

const DIA = 86_400_000;

/** Un usuario con su sistema, que es lo mínimo para escribir cualquier cosa. */
async function base(t: ReturnType<typeof convexTest>, identity = ana) {
  const as = t.withIdentity(identity);
  const userId = await as.mutation(api.users.ensure, {});
  const system = await as.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  return { as, userId, systemId: system.id };
}

/** Los eventos que dejó una acción concreta, sin los de la siembra. */
const conAccion = (t: ReturnType<typeof convexTest>, action: string) =>
  t.run((ctx) => ctx.db.query('eventLog').collect().then((filas) => filas.filter((e) => e.action === action)));

describe('el diff acotado', () => {
  it('un payload que cabe pasa entero', () => {
    const payload = { antes: 'a', despues: 'b' };
    expect(boundPayload(payload)).toBe(payload);
  });

  it('uno que se pasa se sustituye por la marca, no se trunca a medias', () => {
    const grande = { texto: 'x'.repeat(PAYLOAD_MAX_BYTES + 1) };
    const acotado = boundPayload(grande);
    expect(acotado.omitido).toBe(true);
    expect(acotado.bytes).toBeGreaterThan(PAYLOAD_MAX_BYTES);
    // Sigue siendo JSON válido y pequeño.
    expect(new TextEncoder().encode(JSON.stringify(acotado)).byteLength).toBeLessThan(PAYLOAD_MAX_BYTES);
  });
});

describe('la poda del log', () => {
  /** Siembra `total` eventos repartidos entre viejos y recientes. */
  async function sembrar(t: ReturnType<typeof convexTest>, userId: Id<'users'>, viejos: number, recientes: number) {
    const ahora = Date.now();
    const CHUNK = 5_000;
    const insertar = async (cuantos: number, occurredAt: () => number) => {
      for (let hecho = 0; hecho < cuantos; hecho += CHUNK) {
        const lote = Math.min(CHUNK, cuantos - hecho);
        await t.run(async (ctx) => {
          for (let i = 0; i < lote; i += 1) {
            await ctx.db.insert('eventLog', {
              userId,
              actorId: userId,
              actorChannel: 'session',
              action: 'task.create',
              targetType: 'task',
              targetId: `tasks:${hecho + i}`,
              payload: {},
              occurredAt: occurredAt(),
            });
          }
        });
      }
    };
    // Viejos: entre 31 y 60 días. Recientes: menos de 30.
    await insertar(viejos, () => ahora - (RETENTION_DAYS + 1) * DIA - Math.floor(Math.random() * 29) * DIA);
    await insertar(recientes, () => ahora - Math.floor(Math.random() * (RETENTION_DAYS - 1)) * DIA);
  }

  it('cien mil filas se podan por lotes, sin tocar lo de dentro de los treinta días', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.withIdentity(ana).mutation(api.users.ensure, {});
    await sembrar(t, userId, 90_000, 10_000);
    expect(await t.run((ctx) => ctx.db.query('eventLog').collect().then((r) => r.length))).toBe(100_000);

    // Cada llamada borra a lo sumo su tope; se repite hasta que dice que acabó.
    const TOPE = 10_000;
    let vueltas = 0;
    let borradas = 0;
    for (;;) {
      const paso = await t.mutation(internal.eventLog.podar, { limite: TOPE });
      borradas += paso.borradas;
      vueltas += 1;
      expect(paso.borradas).toBeLessThanOrEqual(TOPE);
      if (!paso.quedan) break;
      expect(vueltas).toBeLessThan(20);
    }

    expect(borradas).toBe(90_000);
    expect(vueltas).toBeGreaterThan(1);
    const quedan = await t.run((ctx) => ctx.db.query('eventLog').collect());
    expect(quedan).toHaveLength(10_000);
    const corte = Date.now() - RETENTION_DAYS * DIA;
    expect(quedan.every((doc) => doc.occurredAt >= corte)).toBe(true);
  }, 300_000);

  it('el lote de producción cabe de sobra en el presupuesto de su entrada del cron', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.withIdentity(ana).mutation(api.users.ensure, {});
    // Cinco lotes de producción esperando: la poda se lleva uno y se
    // reprograma, que es lo que hace en el deployment de verdad.
    await sembrar(t, userId, PRUNE_BATCH * 5, 0);

    const inicio = Date.now();
    const paso = await t.mutation(internal.eventLog.podar, {});
    const tardo = Date.now() - inicio;

    expect(paso).toEqual({ borradas: PRUNE_BATCH, quedan: true });
    // Los diez segundos son de la entrada `event-log-prune`, y ahí caben
    // varias podas. Una sola que consumiera la mitad dejaría a la siguiente
    // sin sitio, así que el margen se mide, no se supone.
    expect(tardo).toBeLessThan(2_000);
  }, 60_000);

  it('podar una tabla ya podada no borra nada', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.withIdentity(ana).mutation(api.users.ensure, {});
    await sembrar(t, userId, 10, 5);

    expect((await t.mutation(internal.eventLog.podar, { limite: 100 })).borradas).toBe(10);
    const segunda = await t.mutation(internal.eventLog.podar, { limite: 100 });
    expect(segunda).toEqual({ borradas: 0, quedan: false });
    expect(await t.run((ctx) => ctx.db.query('eventLog').collect().then((r) => r.length))).toBe(5);
  });
});

describe('una escritura, una fila', () => {
  it('crear, editar y borrar una tarea dejan una fila cada uno, con quién y por qué vía', async () => {
    const t = convexTest(schema, modules);
    const { as, userId, systemId } = await base(t);

    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Leer el capítulo' });
    await as.mutation(api.tasks.update, { id: tarea.id, title: 'Leer el capítulo dos', priority: 'high' });
    await as.mutation(api.tasks.remove, { id: tarea.id });

    const filas = await t.run((ctx) =>
      ctx.db.query('eventLog').withIndex('by_target', (q) => q.eq('targetType', 'task').eq('targetId', tarea.id)).collect(),
    );
    expect(filas.map((f) => f.action)).toEqual(['task.create', 'task.update', 'task.remove']);
    for (const fila of filas) expect(fila).toMatchObject({ userId, systemId, actorId: userId, actorChannel: 'session' });

    // El payload de una edición son los valores de **antes** de los campos que
    // cambiaron, que es lo único que el deshacer campo a campo necesita.
    expect(filas[1]!.payload).toEqual({ title: 'Leer el capítulo', priority: 'medium' });
  });

  it('un lote deja una fila por tarea: el log se lee desde el item', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const uno = await as.mutation(api.tasks.create, { systemId, title: 'Una' });
    const dos = await as.mutation(api.tasks.create, { systemId, title: 'Otra' });

    await as.mutation(api.tasks.bulkMove, { taskIds: [uno.id, dos.id], status: 'today' });

    const movidas = await conAccion(t, 'task.move');
    expect(movidas.map((f) => f.targetId).sort()).toEqual([uno.id, dos.id].sort());
  });

  it('una escritura que falla no deja evento', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Buena' });
    const antes = (await t.run((ctx) => ctx.db.query('eventLog').collect())).length;

    // Falla dentro de la mutación, después de la validación de schema: la
    // carpeta no existe. Convex deshace la transacción entera, y el evento va
    // dentro de ella.
    await expect(
      as.mutation(api.tasks.update, { id: tarea.id, folderId: 'k17abcdefghijklmnopqrstuvwxyz' as never }),
    ).rejects.toThrow();

    expect(await t.run((ctx) => ctx.db.query('eventLog').collect().then((r) => r.length))).toBe(antes);
  });

  it('el reorden de una lista no deja fila: sortIndex es la pantalla, no la tarea', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const uno = await as.mutation(api.tasks.create, { systemId, title: 'Una' });
    const dos = await as.mutation(api.tasks.create, { systemId, title: 'Otra' });

    await as.mutation(api.tasks.reorder, { ids: [dos.id, uno.id] });

    expect(await conAccion(t, 'task.reorder')).toHaveLength(0);
  });

  it('el log de un usuario no incluye lo que escribió otro', async () => {
    const t = convexTest(schema, modules);
    const { as: comoAna, systemId: deAna } = await base(t, ana);
    const { as: comoBob, systemId: deBob } = await base(t, bob);
    await comoAna.mutation(api.tasks.create, { systemId: deAna, title: 'De Ana' });
    const suya = await comoBob.mutation(api.tasks.create, { systemId: deBob, title: 'De Bob' });

    const visto = await comoAna.query(api.eventLog.porItem, { targetType: 'task', targetId: suya.id });
    expect(visto.items).toEqual([]);
  });
});

describe('el cuerpo de un capítulo no viaja en el payload', () => {
  it('la edición guarda la marca y el id de la versión, no el texto', async () => {
    const t = convexTest(schema, modules);
    const as = t.withIdentity(ana);
    await as.mutation(api.users.ensure, {});
    const system = await as.mutation(api.systems.create, { name: 'Novela', color: 'blue', templateType: 'writing', icon: 'book' });
    const pagina = await as.mutation(api.pages.create, { systemId: system.id, title: 'Capítulo 1', content: '<p>Primera versión</p>' });

    await as.mutation(api.pages.update, { id: pagina.id, title: 'Capítulo uno', content: `<p>${'palabra '.repeat(2_000)}</p>` });

    const [fila] = await conAccion(t, 'page.update');
    expect(fila!.payload).toEqual({ title: 'Capítulo 1', contenidoCambiado: true });
    expect(fila!.snapshotId).toEqual(expect.any(String));
    const versiones = await t.run((ctx) => ctx.db.query('pageSnapshots').collect());
    expect(versiones.find((v) => v._id === fila!.snapshotId)!.content).toBe('<p>Primera versión</p>');
  });
});

describe('el actor que se puede enseñar', () => {
  it('el nombre sólo aparece cuando el actor es quien lee', () => {
    const lector = { _id: 'users:ana', name: 'Ana' } as never as Parameters<typeof actorDe>[1];
    const propio = { actorId: 'users:ana', actorChannel: 'oauth' } as never as Parameters<typeof actorDe>[0];
    const ajeno = { actorId: 'users:bob', actorChannel: 'session' } as never as Parameters<typeof actorDe>[0];

    expect(actorDe(propio, lector)).toEqual({ kind: 'propio', channel: 'oauth', name: 'Ana' });
    // La variante redactada **no tiene** campo de nombre: no es que venga
    // vacío, es que el tipo no lo admite. Por eso una lectura descuidada no
    // puede filtrarlo.
    expect(actorDe(ajeno, lector)).toEqual({ kind: 'redactado', channel: 'session' });
    expect(actorDe(ajeno, lector)).not.toHaveProperty('name');
  });

  it('en un sistema compartido, la lista dice la vía pero no el nombre de la otra persona', async () => {
    const t = convexTest(schema, modules);
    const { as: comoAna, userId: idAna, systemId } = await base(t, ana);
    const comoBob = t.withIdentity(bob);
    const idBob = await comoBob.mutation(api.users.ensure, {});
    const tarea = await comoAna.mutation(api.tasks.create, { systemId, title: 'Compartida' });

    await t.run(async (ctx) => {
      await ctx.db.insert('systemMembers', { systemId: systemId as never, userId: idBob, role: 'member', createdAt: Date.now() });
      await ctx.db.insert('eventLog', {
        userId: idAna,
        systemId: systemId as never,
        actorId: idBob,
        actorChannel: 'oauth',
        action: 'task.update',
        targetType: 'task',
        targetId: tarea.id,
        payload: { title: 'Compartida' },
        occurredAt: Date.now(),
      });
    });

    const { items } = await comoAna.query(api.eventLog.porItem, { targetType: 'task', targetId: tarea.id });
    const ajeno = items.find((item) => item.actor.kind === 'redactado')!;
    expect(ajeno.actor).toEqual({ kind: 'redactado', channel: 'oauth' });
    expect(JSON.stringify(items)).not.toContain('Bob');
  });
});

describe('la fila cabe en su presupuesto', () => {
  it('las tres columnas del deshacer se escriben en la fila, no dentro del payload', async () => {
    const t = convexTest(schema, modules);
    const { as, userId, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Con enlaces' });
    const propuestaId = await t.run((ctx) =>
      ctx.db.insert('proposals', {
        userId,
        systemId: systemId as never,
        status: 'pending',
        kind: 'archive',
        evidenceType: 'task',
        evidenceId: tarea.id,
        payload: {},
        expiresAt: Date.now() + DIA,
        createdAt: Date.now(),
      }),
    );

    const id = await t.run((ctx) =>
      recordEvent(ctx, {
        userId,
        actorChannel: 'session',
        action: 'task.update',
        targetType: 'task',
        targetId: tarea.id,
        payload: { title: 'Con enlaces' },
        proposalId: propuestaId,
      }),
    );

    const fila = (await t.run((ctx) => ctx.db.get(id)))!;
    // Si alguien las moviera dentro del payload, la columna quedaría vacía y
    // `boundPayload` podría además tirarlas enteras el día que el diff crezca.
    expect(fila.proposalId).toBe(propuestaId);
    expect(fila.payload).toEqual({ title: 'Con enlaces' });
    expect(fila.payload).not.toHaveProperty('proposalId');
    expect(fila.payload).not.toHaveProperty('snapshotId');
    expect(fila.payload).not.toHaveProperty('undoneFields');
  });

  it('ninguna escritura real deja un payload por encima del tope', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'x'.repeat(500) });
    await as.mutation(api.tasks.update, { id: tarea.id, description: 'y'.repeat(9_000) });

    const filas = await t.run((ctx) => ctx.db.query('eventLog').collect());
    expect(filas.length).toBeGreaterThan(0);
    for (const fila of filas) {
      const bytes = new TextEncoder().encode(JSON.stringify(fila.payload)).byteLength;
      expect(bytes, fila.action).toBeLessThanOrEqual(PAYLOAD_MAX_BYTES);
    }
  });
});

describe('deshacer', () => {
  it('devuelve exactamente los campos que la edición tocó, y ninguno más', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Original', priority: 'low' });
    await as.mutation(api.tasks.update, { id: tarea.id, title: 'Reescrita por el agente', priority: 'critical' });

    const [edicion] = await conAccion(t, 'task.update');
    const resultado = await as.mutation(api.eventLog.deshacer, { id: edicion!._id });

    expect(resultado).toEqual({ deshecho: true });
    const vuelta = await as.query(api.tasks.byId, { id: tarea.id });
    expect(vuelta.title).toBe('Original');
    expect(vuelta.priority).toBe('low');
  });

  it('un campo que cambió después de la edición se queda como está', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Original', energyLevel: 'medium' });
    // El agente reescribe el título; después la persona ajusta la energía a mano.
    await as.mutation(api.tasks.update, { id: tarea.id, title: 'Reescrita' });
    await as.mutation(api.tasks.update, { id: tarea.id, energyLevel: 'high' });

    const [primera] = await conAccion(t, 'task.update');
    await as.mutation(api.eventLog.deshacer, { id: primera!._id });

    const vuelta = await as.query(api.tasks.byId, { id: tarea.id });
    expect(vuelta.title).toBe('Original');
    // Deshacer la fila entera habría destruido un cambio que nadie pidió deshacer.
    expect(vuelta.energyLevel).toBe('high');
  });

  it('la edición de un cuaderno vuelve desde la versión guardada, no desde el diff', async () => {
    const t = convexTest(schema, modules);
    const as = t.withIdentity(ana);
    await as.mutation(api.users.ensure, {});
    // Un sistema de proyecto, no de escritura: las versiones son de los siete
    // arquetipos desde que el escritor vive con `pages`.
    const system = await as.mutation(api.systems.create, { name: 'Tesis', color: 'blue', templateType: 'project', icon: 'rocket' });
    const largo = `<p>${'palabra '.repeat(2_000)}</p>`;
    const pagina = await as.mutation(api.pages.create, { systemId: system.id, title: 'Marco teórico', content: largo });

    await as.mutation(api.pages.update, { id: pagina.id, title: 'Marco', content: '<p>Reescrito por el agente.</p>' });

    const [edicion] = await conAccion(t, 'page.update');
    // El cuerpo no está en el payload: por eso el deshacer tiene que ir a la versión.
    expect(edicion!.payload).not.toHaveProperty('content');
    expect(edicion!.snapshotId).toEqual(expect.any(String));

    expect(await as.mutation(api.eventLog.deshacer, { id: edicion!._id })).toMatchObject({ deshecho: true });
    const vuelta = await as.query(api.pages.byId, { id: pagina.id });
    expect(vuelta.content).toBe(largo);
    expect(vuelta.title).toBe('Marco teórico');
  });

  it('el reparto del ritual se deshace al revés y devuelve las cien tareas', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tareas = [];
    for (let i = 0; i < 100; i += 1) {
      const tarea = await as.mutation(api.tasks.create, { systemId, title: `Vencida ${i}`, dueDate: '2026-01-01T12:00:00Z' });
      tareas.push(tarea.id);
    }

    await as.mutation(api.energy.applyWeeklyRitual, {
      assignments: tareas.map((taskId, i) => ({ taskId, date: `2026-09-${String(8 + (i % 5)).padStart(2, '0')}` })),
    });
    expect((await as.query(api.tasks.byId, { id: tareas[0]! })).startDate).not.toBeNull();

    const [reparto] = await conAccion(t, 'energy.applyWeeklyRitual');
    expect(await as.mutation(api.eventLog.deshacer, { id: reparto!._id })).toEqual({ deshecho: true });

    for (const id of [tareas[0]!, tareas[50]!, tareas[99]!]) {
      expect((await as.query(api.tasks.byId, { id })).startDate, id).toBeNull();
    }
  }, 120_000);

  it('lo que no se deshace responde con el motivo, no con un error', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Trabajada' });
    await as.mutation(api.tasks.createTimeLog, {
      id: tarea.id,
      systemId,
      startedAt: '2026-09-08T10:00:00Z',
      endedAt: '2026-09-08T10:45:00Z',
      durationMinutes: 45,
    });

    const [apunte] = await conAccion(t, 'task.createTimeLog');
    expect(await as.mutation(api.eventLog.deshacer, { id: apunte!._id })).toEqual({
      deshecho: false,
      motivo: 'El tiempo trabajado es un hecho, no una edición: borrarlo sería borrar que trabajaste.',
    });
  });

  it('deja su propio evento, marca el original y no se deja deshacer dos veces', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Original' });
    await as.mutation(api.tasks.update, { id: tarea.id, title: 'Cambiada' });

    const [edicion] = await conAccion(t, 'task.update');
    await as.mutation(api.eventLog.deshacer, { id: edicion!._id });

    const original = (await conAccion(t, 'task.update'))[0]!;
    expect(original.undoneAt).toEqual(expect.any(Number));
    expect(original.undoneFields).toEqual(['title']);

    const [suyo] = await conAccion(t, 'log.deshacer');
    expect(suyo).toMatchObject({ targetType: 'task', targetId: tarea.id, payload: { deshace: 'task.update', campos: ['title'] } });

    expect(await as.mutation(api.eventLog.deshacer, { id: edicion!._id })).toEqual({ deshecho: false, motivo: 'Esto ya se deshizo.' });
  });

  it('la creación se deshace mandando a la papelera, y el borrado sacándola', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Del agente' });

    const [creacion] = await conAccion(t, 'task.create');
    const borrada = () => t.run((ctx) => ctx.db.query('tasks').collect().then((filas) => filas.find((f) => f._id === tarea.id)!.deletedAt));

    expect(await as.mutation(api.eventLog.deshacer, { id: creacion!._id })).toEqual({ deshecho: true });
    expect(await borrada()).toEqual(expect.any(Number));

    await as.mutation(api.tasks.restore, { id: tarea.id });
    const [restauracion] = await conAccion(t, 'task.restore');
    await as.mutation(api.eventLog.deshacer, { id: restauracion!._id });
    expect(await borrada()).toEqual(expect.any(Number));
  });

  it('el cambio de otra persona no se deshace desde tu cuenta', async () => {
    const t = convexTest(schema, modules);
    const { as: comoAna, systemId } = await base(t, ana);
    const comoBob = t.withIdentity(bob);
    await comoBob.mutation(api.users.ensure, {});
    await comoAna.mutation(api.tasks.create, { systemId, title: 'De Ana' });

    const [creacion] = await conAccion(t, 'task.create');
    expect(await comoBob.mutation(api.eventLog.deshacer, { id: creacion!._id })).toEqual({
      deshecho: false,
      motivo: 'Ese cambio no es tuyo.',
    });
  });

  it('la fila dice si trae botón antes de que nadie lo pulse, con la misma función', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Con historia' });
    await as.mutation(api.tasks.createTimeLog, {
      id: tarea.id,
      systemId,
      startedAt: '2026-09-08T10:00:00Z',
      endedAt: '2026-09-08T10:45:00Z',
      durationMinutes: 45,
    });

    const { items } = await as.query(api.eventLog.porItem, { targetType: 'task', targetId: tarea.id });
    const porAccion = new Map(items.map((item) => [item.action, item.deshacer]));
    expect(porAccion.get('task.create')).toEqual({ forma: 'inverse' });
    expect(porAccion.get('task.createTimeLog')).toEqual({
      forma: 'no',
      motivo: 'El tiempo trabajado es un hecho, no una edición: borrarlo sería borrar que trabajaste.',
    });
  });
});

describe('lo que hizo tu agente hoy', () => {
  /** El navegador de Ana y su agente, que entra por el conector. */
  async function conAgente(t: ReturnType<typeof convexTest>) {
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.users.ensure, {});
    const system = await asAna.mutation(api.systems.create, { name: 'Tesis', color: 'blue', templateType: 'project', icon: 'rocket' });
    // El canal `oauth` sale del emisor del token, que es lo que distingue al
    // conector del navegador: sin él, esto sería Ana escribiendo desde la app.
    const agente = t.withIdentity({ ...ana, issuer: MCP_TOKEN_ISSUER, kino_client: 'claude_code' });
    return { asAna, agente, systemId: system.id };
  }

  it('cuenta lo que dice: agrupa por acción y nombra los sistemas', async () => {
    const t = convexTest(schema, modules);
    const { asAna, agente, systemId } = await conAgente(t);
    const creadas = [];
    for (let i = 0; i < 4; i += 1) creadas.push(await agente.mutation(api.tasks.create, { systemId, title: `Tarea ${i}` }));
    await agente.mutation(api.tasks.move, { id: creadas[0]!.id, status: 'today' });
    // Lo que escribe la persona no es actividad del agente.
    await asAna.mutation(api.tasks.create, { systemId, title: 'Mía' });

    const resumen = (await asAna.query(api.eventLog.delAgenteHoy, {}))!;
    expect(resumen.total).toBe(5);
    expect(resumen.acciones).toEqual([
      { action: 'task.create', cuantas: 4 },
      { action: 'task.move', cuantas: 1 },
    ]);
    expect(resumen.sistemas).toEqual(['Tesis']);
  });

  it('sin acciones de agente hoy no hay fila que pintar', async () => {
    const t = convexTest(schema, modules);
    const { asAna, systemId } = await conAgente(t);
    await asAna.mutation(api.tasks.create, { systemId, title: 'Mía' });

    expect(await asAna.query(api.eventLog.delAgenteHoy, {})).toBeNull();
  });

  it('lo de ayer no cuenta: la fila es del día', async () => {
    const t = convexTest(schema, modules);
    const { asAna, agente, systemId } = await conAgente(t);
    await agente.mutation(api.tasks.create, { systemId, title: 'De ayer' });
    await t.run(async (ctx) => {
      for (const fila of await ctx.db.query('eventLog').collect()) {
        await ctx.db.patch(fila._id, { occurredAt: fila.occurredAt - 2 * DIA });
      }
    });

    expect(await asAna.query(api.eventLog.delAgenteHoy, {})).toBeNull();
  });

  it('deshacer en bloque deshace las N y deja N eventos de deshacer, cada uno con su marca', async () => {
    const t = convexTest(schema, modules);
    const { asAna, agente, systemId } = await conAgente(t);
    const creadas = [];
    for (let i = 0; i < 4; i += 1) creadas.push(await agente.mutation(api.tasks.create, { systemId, title: `Tarea ${i}` }));
    await agente.mutation(api.tasks.move, { id: creadas[0]!.id, status: 'today' });

    expect(await asAna.mutation(api.eventLog.deshacerDelAgente, {})).toEqual({ deshechas: 5, sinDeshacer: [] });

    // Un deshacer en bloque que no se pueda auditar acción por acción sería la
    // escritura opaca que el log existe para evitar.
    const deshechos = await conAccion(t, 'log.deshacer');
    expect(deshechos).toHaveLength(5);
    expect(deshechos.every((fila) => fila.payload.deshace !== undefined)).toBe(true);

    const vivas = await t.run((ctx) => ctx.db.query('tasks').collect());
    expect(vivas.filter((tarea) => tarea.deletedAt === undefined)).toEqual([]);
    // Y ya no queda nada que deshacer: la fila desaparece.
    expect(await asAna.query(api.eventLog.delAgenteHoy, {})).toBeNull();
  });

  it('lo que no se puede deshacer se cuenta aparte en vez de tumbar el resto', async () => {
    const t = convexTest(schema, modules);
    const { asAna, agente, systemId } = await conAgente(t);
    const tarea = await agente.mutation(api.tasks.create, { systemId, title: 'Trabajada' });
    await agente.mutation(api.tasks.createTimeLog, {
      id: tarea.id,
      systemId,
      startedAt: '2026-09-08T10:00:00Z',
      endedAt: '2026-09-08T10:45:00Z',
      durationMinutes: 45,
    });

    const resultado = await asAna.mutation(api.eventLog.deshacerDelAgente, {});
    expect(resultado.deshechas).toBe(1);
    expect(resultado.sinDeshacer).toEqual([
      'El tiempo trabajado es un hecho, no una edición: borrarlo sería borrar que trabajaste.',
    ]);
  });

  it('el deshacer del agente no cuenta como actividad suya', async () => {
    const t = convexTest(schema, modules);
    const { asAna, agente, systemId } = await conAgente(t);
    await agente.mutation(api.tasks.create, { systemId, title: 'Una' });
    await asAna.mutation(api.eventLog.deshacerDelAgente, {});

    // Si contara, la fila diría que hizo más cosas justo después de deshacerlas.
    expect(await asAna.query(api.eventLog.delAgenteHoy, {})).toBeNull();
  });

  it('la fila no entra en la cola: con ella delante sigue habiendo como mucho una interrupción', async () => {
    const t = convexTest(schema, modules);
    const { asAna, agente, systemId } = await conAgente(t);
    for (let i = 0; i < 4; i += 1) await agente.mutation(api.tasks.create, { systemId, title: `Tarea ${i}` });

    expect((await asAna.query(api.eventLog.delAgenteHoy, {}))!.total).toBe(4);
    // Informa, no pregunta: no gasta la única apertura del día.
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });
});
