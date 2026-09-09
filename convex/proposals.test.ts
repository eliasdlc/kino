/**
 * Qué se prueba: que una propuesta es una fila con estado y con evidencia
 * resuelta por el servidor, y no una afirmación del agente. Aceptarla escribe
 * por el mismo camino que el navegador (evento y deshacer incluidos),
 * descartarla es terminal, la caducada no se aplica, y veinte pendientes tienen
 * una salida de grupo que no obliga a resolverlas de una en una.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import { EXPIRES_IN_DAYS, MAX_PENDING, REWRITE_MAX_BYTES } from './proposals';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const DIA = 86_400_000;

/** El navegador de Ana, y su agente con alcance de proponer y su origen firmado. */
async function seed(t: ReturnType<typeof convexTest>, origen = 'claude_desktop') {
  const asAna = t.withIdentity(ana);
  await asAna.mutation(api.users.ensure, {});
  const system = await asAna.mutation(api.systems.create, { name: 'Tesis', color: 'blue', templateType: 'project', icon: 'rocket' });
  const agente = t.withIdentity({ ...ana, kino_scope: 'propose', kino_client: origen });
  return { asAna, agente, systemId: system.id };
}

describe('la evidencia es una referencia, no una afirmación', () => {
  it('proponer sobre algo que no existe se rechaza en el acto', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Existe' });
    const inventado = tarea.id.slice(0, -1) + (tarea.id.endsWith('a') ? 'b' : 'a');

    await expect(
      agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: inventado }),
    ).rejects.toThrow();
  });

  it('si la fila desaparece después, la propuesta deja de pintarse', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Se va a ir' });
    await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });

    expect(await asAna.query(api.proposals.pendientes, {})).toHaveLength(1);

    await asAna.mutation(api.tasks.remove, { id: tarea.id });

    // Una propuesta sobre algo que ya no está no describe nada.
    expect(await asAna.query(api.proposals.pendientes, {})).toEqual([]);
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('la lista trae el título que el servidor resolvió, no uno que el agente escribiera', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Marco teórico' });
    await agente.mutation(api.proposals.create, {
      kind: 'cancel',
      evidenceType: 'task',
      evidenceId: tarea.id,
      motivo: 'Lleva dos meses sin tocarse',
    });

    const [propuesta] = await asAna.query(api.proposals.pendientes, {});
    expect(propuesta).toMatchObject({
      kind: 'cancel',
      origen: 'claude_desktop',
      motivo: 'Lleva dos meses sin tocarse',
      caducada: false,
      evidencia: { tipo: 'task', id: tarea.id, titulo: 'Marco teórico' },
    });
  });
});

describe('aceptar una propuesta', () => {
  it('cancelar manda a la papelera, con su evento y su deshacer', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Sobra' });
    const { id } = await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });

    expect(await asAna.mutation(api.proposals.aplicar, { id })).toEqual({ aplicada: true });

    const borrada = await t.run((ctx) => ctx.db.query('tasks').collect().then((f) => f.find((x) => x._id === tarea.id)!));
    expect(borrada.deletedAt).toEqual(expect.any(Number));

    // El evento dice que salió de una propuesta, y se deshace como cualquier
    // otro borrado: aceptar no es una escritura sin red.
    const { items } = await asAna.query(api.eventLog.porItem, { targetType: 'task', targetId: tarea.id });
    const borrado = items.find((e) => e.action === 'task.remove')!;
    expect(borrado.desdePropuesta).toBe(true);
    expect(borrado.deshacer).toEqual({ forma: 'inverse' });

    await asAna.mutation(api.eventLog.deshacer, { id: borrado.id });
    const vuelta = await t.run((ctx) => ctx.db.query('tasks').collect().then((f) => f.find((x) => x._id === tarea.id)!));
    expect(vuelta.deletedAt).toBeUndefined();
  });

  it('reescribir pasa por la misma edición que el navegador: archiva la versión y se deshace', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna } = await seed(t);
    const escritura = await asAna.mutation(api.systems.create, { name: 'Novela', color: 'blue', templateType: 'writing', icon: 'book' });
    const original = '<p>Lo que yo escribí.</p>';
    const pagina = await asAna.mutation(api.pages.create, { systemId: escritura.id, title: 'Capítulo 1', content: original });

    const { id } = await agente.mutation(api.proposals.create, {
      kind: 'rewrite',
      evidenceType: 'page',
      evidenceId: pagina.id,
      contenido: '<p>Lo que el agente propone.</p>',
    });
    await asAna.mutation(api.proposals.aplicar, { id });

    expect((await asAna.query(api.pages.byId, { id: pagina.id })).content).toBe('<p>Lo que el agente propone.</p>');

    const { items } = await asAna.query(api.eventLog.porItem, { targetType: 'page', targetId: pagina.id });
    const edicion = items.find((e) => e.action === 'page.update')!;
    expect(edicion.desdePropuesta).toBe(true);

    await asAna.mutation(api.eventLog.deshacer, { id: edicion.id });
    expect((await asAna.query(api.pages.byId, { id: pagina.id })).content).toBe(original);
  });

  it('una propuesta caducada no se aplica y lo dice', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Vieja' });
    const { id } = await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });
    await t.run((ctx) => ctx.db.patch(id, { expiresAt: Date.now() - DIA }));

    const resultado = await asAna.mutation(api.proposals.aplicar, { id });
    expect(resultado.aplicada).toBe(false);
    expect(resultado.motivo).toContain('caducó');

    const viva = await t.run((ctx) => ctx.db.query('tasks').collect().then((f) => f.find((x) => x._id === tarea.id)!));
    expect(viva.deletedAt).toBeUndefined();
  });

  it('la caducada se ve, con su marca, en vez de desaparecer en silencio', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Vieja' });
    const { id } = await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });
    await t.run((ctx) => ctx.db.patch(id, { expiresAt: Date.now() - DIA }));

    expect((await asAna.query(api.proposals.pendientes, {}))[0]!.caducada).toBe(true);
    // Y no interrumpe: lo que ya no describe la realidad no gasta la apertura.
    expect(await asAna.query(api.today.interruption, {})).toBeNull();

    expect(await asAna.mutation(api.proposals.caducar, {})).toEqual({ cuantas: 1 });
    expect(await asAna.query(api.proposals.pendientes, {})).toEqual([]);
  });
});

describe('descartar', () => {
  it('una descartada no vuelve', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'No, gracias' });
    const { id } = await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });

    expect(await asAna.mutation(api.proposals.descartar, { id })).toEqual({ descartada: true });
    expect(await asAna.query(api.proposals.pendientes, {})).toEqual([]);
    expect(await asAna.mutation(api.proposals.descartar, { id })).toEqual({ descartada: false });
    expect(await asAna.mutation(api.proposals.aplicar, { id })).toMatchObject({ aplicada: false });
  });

  it('con la cola llena, descartar un origen la abre sin tocar la de los demás', async () => {
    const t = convexTest(schema, modules);
    const { asAna, systemId } = await seed(t);
    const enBucle = t.withIdentity({ ...ana, kino_scope: 'propose', kino_client: 'agente_en_bucle' });
    const otro = t.withIdentity({ ...ana, kino_scope: 'propose', kino_client: 'claude_code' });

    const tareas: string[] = [];
    for (let i = 0; i < MAX_PENDING; i += 1) {
      const tarea = await asAna.mutation(api.tasks.create, { systemId, title: `Tarea ${i}` });
      tareas.push(tarea.id);
    }
    for (let i = 0; i < MAX_PENDING - 1; i += 1) {
      await enBucle.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tareas[i]! });
    }
    await otro.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tareas[MAX_PENDING - 1]! });

    // La cola está llena: nadie más cabe, ni el que se portó bien.
    const unaMas = await asAna.mutation(api.tasks.create, { systemId, title: 'Una más' });
    await expect(
      otro.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: unaMas.id }),
    ).rejects.toThrow();

    expect(await asAna.mutation(api.proposals.descartarOrigen, { origen: 'agente_en_bucle' })).toEqual({ cuantas: MAX_PENDING - 1 });

    const quedan = await asAna.query(api.proposals.pendientes, {});
    expect(quedan).toHaveLength(1);
    expect(quedan[0]!.origen).toBe('claude_code');
    // Y vuelve a caber.
    expect((await otro.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: unaMas.id })).id).toBeDefined();
  });
});

describe('los topes', () => {
  it('un cuerpo propuesto por encima del tope se rechaza con el límite en el mensaje', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna } = await seed(t);
    const escritura = await asAna.mutation(api.systems.create, { name: 'Novela', color: 'blue', templateType: 'writing', icon: 'book' });
    const pagina = await asAna.mutation(api.pages.create, { systemId: escritura.id, title: 'Capítulo', content: '<p>x</p>' });

    await expect(
      agente.mutation(api.proposals.create, {
        kind: 'rewrite',
        evidenceType: 'page',
        evidenceId: pagina.id,
        contenido: 'y'.repeat(REWRITE_MAX_BYTES + 1),
      }),
    ).rejects.toThrow(String(REWRITE_MAX_BYTES));
  });

  it('reescribir sin texto propuesto no se puede crear: no habría qué aplicar', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna } = await seed(t);
    const escritura = await asAna.mutation(api.systems.create, { name: 'Novela', color: 'blue', templateType: 'writing', icon: 'book' });
    const pagina = await asAna.mutation(api.pages.create, { systemId: escritura.id, title: 'Capítulo', content: '<p>x</p>' });

    await expect(
      agente.mutation(api.proposals.create, { kind: 'rewrite', evidenceType: 'page', evidenceId: pagina.id }),
    ).rejects.toThrow();
  });

  it('caduca a los catorce días', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Tarea' });

    const { expiresAt } = await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });

    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now() + (EXPIRES_IN_DAYS - 1) * DIA);
    expect(Date.parse(expiresAt)).toBeLessThanOrEqual(Date.now() + EXPIRES_IN_DAYS * DIA);
  });
});

describe('la propuesta en Hoy', () => {
  it('ocupa la interrupción del día con su evidencia resuelta', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Marco teórico' });
    const { id } = await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });

    const interrupcion = await asAna.query(api.today.interruption, {});
    expect(interrupcion).toMatchObject({
      kind: 'agente',
      key: id,
      payload: { kind: 'cancel', evidencia: { tipo: 'task', titulo: 'Marco teórico', systemId } },
    });
  });

  it('sigue habiendo como mucho una: dos propuestas no son dos interrupciones', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    for (let i = 0; i < 3; i += 1) {
      const tarea = await asAna.mutation(api.tasks.create, { systemId, title: `Tarea ${i}` });
      await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });
    }

    const interrupcion = await asAna.query(api.today.interruption, {});
    expect(interrupcion).not.toBeNull();
    expect(await asAna.query(api.proposals.pendientes, {})).toHaveLength(3);
  });

  it('un id de propuesta ajeno no se aplica desde otra cuenta', async () => {
    const t = convexTest(schema, modules);
    const { agente, asAna, systemId } = await seed(t);
    const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'De Ana' });
    const { id } = await agente.mutation(api.proposals.create, { kind: 'cancel', evidenceType: 'task', evidenceId: tarea.id });

    const bob = t.withIdentity({ subject: 'user_bob', email: 'bob@usekino.dev', name: 'Bob' });
    await bob.mutation(api.users.ensure, {});
    await expect(bob.mutation(api.proposals.aplicar, { id })).rejects.toThrow();
  });
});
