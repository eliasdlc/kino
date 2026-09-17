/**
 * Las reglas del refresco de GitHub sobre el tablero: de quién es el cursor
 * incremental, qué pasa con una tarjeta que está en la papelera, y qué no puede
 * mover un issue que sólo recibió un comentario.
 *
 * Son las tres formas de perder trabajo que tiene esta integración: issues que
 * no vuelven nunca, tarjetas que resucitan, y tareas completadas que se
 * descompletan solas.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/** Dos sistemas de tipo proyecto, cada uno con su repositorio, y la cuenta conectada. */
async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const kino = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  const conocerd = await asAna.mutation(api.systems.create, { name: 'ConoceRD', color: 'green', templateType: 'project', icon: 'map' });
  await t.run(async (ctx) => {
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'todo', label: 'Por hacer', position: 0 });
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'doing', label: 'En curso', position: 1 });
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'done', label: 'Hecho', position: 2 });
    await ctx.db.insert('syncConnections', { userId, provider: 'github', accessTokenEncrypted: 'cifrado', createdAt: Date.now(), updatedAt: Date.now() });
    return null;
  });
  await t.mutation(internal.githubData.linkRepoMeta, { userId, systemId: kino.id, owner: 'eliasdlc', repo: 'kino' });
  await t.mutation(internal.githubData.linkRepoMeta, { userId, systemId: conocerd.id, owner: 'eliasdlc', repo: 'conocerd' });
  return { t, asAna, userId, kino: kino.id, conocerd: conocerd.id };
}

const issue = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  number: 1,
  title: 'Arreglar el mapa',
  body: null,
  state: 'open' as const,
  htmlUrl: 'https://github.com/eliasdlc/kino/issues/1',
  milestone: null,
  ...overrides,
});

describe('el cursor incremental', () => {
  it('es de cada sistema: el segundo repositorio no hereda hasta dónde llegó el primero', async () => {
    const { t, userId, kino, conocerd } = await seed();
    const cursor = (systemId: typeof kino) => t.query(internal.githubData.systemForSync, { userId, systemId });
    const hasta = Date.now() - 60_000;

    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: hasta, issues: [issue()] });

    expect((await cursor(kino)).syncedThrough).toBe(hasta);
    // Lo que rompía: el segundo sistema arrancaba desde el cursor del primero y
    // sus issues viejos no entraban en ningún refresco.
    expect((await cursor(conocerd)).syncedThrough).toBeNull();
  });

  it('enlazar otro repositorio lo borra: el nuevo se trae entero', async () => {
    const { t, userId, kino } = await seed();
    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue()] });

    await t.mutation(internal.githubData.linkRepoMeta, { userId, systemId: kino, owner: 'eliasdlc', repo: 'otro' });

    const despues = await t.query(internal.githubData.systemForSync, { userId, systemId: kino });
    expect(despues.repo).toEqual({ owner: 'eliasdlc', repo: 'otro' });
    expect(despues.syncedThrough).toBeNull();
  });

  it('sin valor, el cursor se queda donde estaba', async () => {
    const { t, userId, kino } = await seed();
    const hasta = Date.now() - 60_000;
    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: hasta, issues: [issue()] });

    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: true, issues: [issue()] });

    expect((await t.query(internal.githubData.systemForSync, { userId, systemId: kino })).syncedThrough).toBe(hasta);
  });
});

describe('una tarjeta en la papelera', () => {
  /** Importa el issue y manda su tarjeta a la papelera. */
  async function conTarjetaBorrada() {
    const base = await seed();
    await base.t.mutation(internal.githubData.applySync, { userId: base.userId, systemId: base.kino, truncated: false, syncedThrough: Date.now(), issues: [issue()] });
    const tarjeta = (await base.t.run((ctx) => ctx.db.query('tasks').collect()))[0]!;
    await base.asAna.mutation(api.tasks.remove, { id: tarjeta._id });
    return { ...base, tarjeta: tarjeta._id };
  }

  it('no vuelve al tablero porque el issue siga vivo en GitHub', async () => {
    const { t, userId, kino, tarjeta } = await conTarjetaBorrada();

    const resultado = await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue({ title: 'Con un comentario nuevo' })] });

    expect(resultado).toMatchObject({ imported: 0, updated: 0, unchanged: 1 });
    const tareas = await t.run((ctx) => ctx.db.query('tasks').collect());
    expect(tareas).toHaveLength(1);
    expect(tareas[0]!._id).toBe(tarjeta);
    expect(tareas[0]!.deletedAt).toBeTypeOf('number');
  });

  it('se restaura sin duplicarse, porque el refresco no creó ninguna gemela', async () => {
    const { t, asAna, userId, kino, tarjeta } = await conTarjetaBorrada();
    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue()] });

    await asAna.mutation(api.tasks.restore, { id: tarjeta });

    const vivas = (await t.run((ctx) => ctx.db.query('tasks').collect())).filter((doc) => doc.deletedAt === undefined);
    expect(vivas).toHaveLength(1);
    expect(vivas[0]!._id).toBe(tarjeta);
  });

  // Los duplicados que el defecto ya dejó en la base: restaurar la de la
  // papelera pondría dos tarjetas del mismo issue en el tablero.
  // El estado que dejó el defecto viejo: una tarjeta en la papelera y su gemela
  // viva, las dos con la misma llave externa. Cuál de las dos manda no puede
  // salir del orden en que el índice devuelve los documentos.
  it('con una gemela viva, el refresco mueve la viva y no se queda mirando la de la papelera', async () => {
    const { t, asAna, userId, kino, tarjeta } = await conTarjetaBorrada();
    const gemela = await asAna.mutation(api.tasks.create, { systemId: kino, title: '#1 Arreglar el mapa' });
    await t.run((ctx) => ctx.db.patch(gemela.id, { externalSource: 'github', externalId: '1' }));

    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue({ state: 'closed' })] });

    expect((await t.run((ctx) => ctx.db.get(gemela.id)))!.boardStatus).toBe('done');
    // Y la de la papelera sigue donde estaba: nadie la resucita ni la toca.
    const borrada = (await t.run((ctx) => ctx.db.get(tarjeta)))!;
    expect(borrada.deletedAt).toBeTypeOf('number');
    expect(borrada.boardStatus).toBe('todo');
  });

  it('con una gemela viva del mismo issue, restaurarla falla en vez de duplicarla', async () => {
    const { t, asAna, kino, tarjeta } = await conTarjetaBorrada();
    // La gemela que el defecto ya creó: misma llave externa, viva en el tablero.
    const gemela = await asAna.mutation(api.tasks.create, { systemId: kino, title: '#1 Arreglar el mapa' });
    await t.run((ctx) => ctx.db.patch(gemela.id, { externalSource: 'github', externalId: '1' }));

    await expect(asAna.mutation(api.tasks.restore, { id: tarjeta })).rejects.toMatchObject({ data: { code: 'CONFLICT' } });
  });
});

describe('la columna terminal', () => {
  /** Importa el issue abierto y devuelve su tarjeta. */
  async function conTarjeta() {
    const base = await seed();
    await base.t.mutation(internal.githubData.applySync, { userId: base.userId, systemId: base.kino, truncated: false, syncedThrough: Date.now(), issues: [issue()] });
    const tarjeta = (await base.t.run((ctx) => ctx.db.query('tasks').collect()))[0]!;
    return { ...base, tarjeta: tarjeta._id };
  }

  // El defecto: cerrar el trabajo en Kino y cerrar el issue son dos cosas, y un
  // comentario en GitHub mueve el issue sin reabrirlo.
  it('una tarea completada en Kino sigue completada cuando el issue recibe un comentario', async () => {
    const { t, asAna, userId, kino, tarjeta } = await conTarjeta();
    await asAna.mutation(api.tasks.moveBoard, { id: tarjeta, boardStatus: 'done' });

    const resultado = await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue()] });

    const despues = (await t.run((ctx) => ctx.db.get(tarjeta)))!;
    expect(resultado).toMatchObject({ updated: 0, unchanged: 1 });
    expect(despues.boardStatus).toBe('done');
    expect(despues.status).toBe('done');
    expect(despues.completedVia).toBe('session');
  });

  it('reabrir el issue sí saca de la terminal la tarjeta que cerró la sincronización', async () => {
    const { t, userId, kino, tarjeta } = await conTarjeta();
    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue({ state: 'closed' })] });
    expect((await t.run((ctx) => ctx.db.get(tarjeta)))!.completedVia).toBe('sync');

    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue({ state: 'open' })] });

    const despues = (await t.run((ctx) => ctx.db.get(tarjeta)))!;
    expect(despues.boardStatus).toBe('todo');
    expect(despues.status).not.toBe('done');
  });
});

describe('el sitio de una tarjeta nueva', () => {
  // La petición pide del más viejo al más nuevo para que el cursor avance. Si
  // el sitio saliera de ese bucle, el tablero nacería al revés.
  it('sale del número del issue, no del orden en que GitHub los devolvió', async () => {
    const { t, userId, kino } = await seed();

    await t.mutation(internal.githubData.applySync, {
      userId,
      systemId: kino,
      truncated: false,
      syncedThrough: Date.now(),
      issues: [issue({ id: 1, number: 1, title: 'El más viejo' }), issue({ id: 2, number: 2, title: 'El más nuevo' })],
    });

    const tareas = await t.run((ctx) => ctx.db.query('tasks').collect());
    const viejo = tareas.find((doc) => doc.externalId === '1')!;
    const nuevo = tareas.find((doc) => doc.externalId === '2')!;
    expect(nuevo.sortIndex).toBeLessThan(viejo.sortIndex);
  });

  it('los sprints se ordenan por el milestone, no por el issue que lo mencionó primero', async () => {
    const { t, userId, kino } = await seed();
    const hito = (id: number, title: string) => ({ id, title, description: null, dueOn: null, state: 'open' as const });

    await t.mutation(internal.githubData.applySync, {
      userId,
      systemId: kino,
      truncated: false,
      syncedThrough: Date.now(),
      issues: [issue({ id: 1, number: 1, milestone: hito(20, 'Sprint 2') }), issue({ id: 2, number: 2, milestone: hito(10, 'Sprint 1') })],
    });

    const sprints = await t.run((ctx) => ctx.db.query('sprints').collect());
    const primero = sprints.find((s) => s.externalId === '10')!;
    const segundo = sprints.find((s) => s.externalId === '20')!;
    expect(primero.sortOrder).toBeLessThan(segundo.sortOrder);
  });
});
