import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { actorDe, boundPayload, PAYLOAD_MAX_BYTES, PRUNE_BATCH, recordEvent, RETENTION_DAYS } from './eventLog';
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
