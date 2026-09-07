/**
 * Las fuentes conectadas: que sólo entre la que tiene código, que un refresco
 * parcial no pise lo que Kino añadió encima de un issue importado, y que el
 * cursor avance sin escribir tareas cuando no hay nada nuevo.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import { KINO_OWNED_FIELDS } from '../src/features/github-sync/github-sync.mapper';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/** Los seis valores del schema que nunca tuvieron código detrás. */
const MUERTOS = ['google_calendar', 'jira', 'slack', 'microsoft_teams', 'notion', 'ical'] as const;

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const system = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  await t.run(async (ctx) => {
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'todo', label: 'Por hacer', position: 0 });
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'done', label: 'Hecho', position: 1 });
    await ctx.db.insert('syncConnections', {
      userId,
      provider: 'github',
      accessTokenEncrypted: 'cifrado',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  });
  return { t, asAna, userId, systemId: system.id };
}

const issue = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  number: 1,
  title: 'Arreglar el mapa',
  body: null,
  state: 'open' as const,
  htmlUrl: 'https://github.com/x/y/issues/1',
  milestone: null,
  ...overrides,
});

describe('las fuentes conectadas', () => {
  it('sólo github entra; los seis valores muertos del schema se rechazan', async () => {
    const { asAna } = await seed();
    for (const muerto of MUERTOS) {
      await expect(
        asAna.mutation(api.connections.forget, { provider: muerto as never }),
        muerto,
      ).rejects.toThrow();
    }
    await expect(asAna.mutation(api.connections.forget, { provider: 'github' })).resolves.toBeNull();
  });

  it('la lista trae una entrada por proveedor vivo, conectado o no', async () => {
    const { asAna } = await seed();
    const fuentes = await asAna.query(api.connections.list, {});
    expect(fuentes).toHaveLength(1);
    expect(fuentes[0]).toMatchObject({ provider: 'github', connected: true, linkedSystems: 0 });

    await asAna.mutation(api.connections.forget, { provider: 'github' });
    // Olvidarla no la borra de la lista: si no, no habría dónde reconectar.
    expect(await asAna.query(api.connections.list, {})).toMatchObject([{ provider: 'github', connected: false }]);
  });

  it('un refresco no pisa ninguno de los campos que Kino posee sobre un issue importado', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await t.mutation(internal.githubData.applySync, { userId, systemId, truncated: false, syncedThrough: Date.now(), issues: [issue()] });

    const importada = (await t.run((ctx) => ctx.db.query('tasks').collect()))[0]!;
    // Kino escribe encima todo lo que es suyo.
    await asAna.mutation(api.tasks.update, {
      id: importada._id,
      energyLevel: 'high',
      priority: 'critical',
      dueDate: new Date('2026-12-01T00:00:00.000Z').toISOString(),
      startDate: new Date('2026-11-01T00:00:00.000Z').toISOString(),
      estimatedTime: '02:30',
      inTodayPlan: true,
    });
    const antes = (await t.run((ctx) => ctx.db.get(importada._id)))!;

    // Y el issue vuelve con otro título: el refresco escribe lo del proveedor.
    await t.mutation(internal.githubData.applySync, {
      userId,
      systemId,
      truncated: false,
      syncedThrough: Date.now(),
      issues: [issue({ title: 'Arreglar el mapa de verdad' })],
    });
    const despues = (await t.run((ctx) => ctx.db.get(importada._id)))!;

    expect(despues.title).not.toBe(antes.title);
    for (const campo of KINO_OWNED_FIELDS) {
      expect(despues[campo], campo).toEqual(antes[campo]);
    }
  });

  it('el cursor avanza, y un segundo refresco sin cambios no escribe ninguna tarea', async () => {
    const { t, userId, systemId } = await seed();
    const primero = Date.now() - 60_000;
    await t.mutation(internal.githubData.applySync, { userId, systemId, truncated: false, syncedThrough: primero, issues: [issue()] });

    const conexion = () => t.run((ctx) => ctx.db.query('syncConnections').first());
    expect((await conexion())!.syncedThrough).toBe(primero);
    const tareasAntes = await t.run((ctx) => ctx.db.query('tasks').collect());

    // Con el cursor puesto, GitHub no devuelve nada: la llamada llega vacía.
    const segundo = Date.now();
    const resultado = await t.mutation(internal.githubData.applySync, { userId, systemId, truncated: false, syncedThrough: segundo, issues: [] });

    expect(resultado).toMatchObject({ imported: 0, updated: 0, unchanged: 0 });
    expect((await conexion())!.syncedThrough).toBe(segundo);
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toEqual(tareasAntes);
  });

  it('las fuentes de una persona no se ven desde la cuenta de otra', async () => {
    const { t } = await seed();
    const beto = t.withIdentity({ subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' });
    await beto.mutation(api.users.ensure, {});
    expect(await beto.query(api.connections.list, {})).toMatchObject([{ provider: 'github', connected: false }]);
  });
});
