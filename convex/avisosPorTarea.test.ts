/**
 * La migración que escribe el próximo aviso de las tareas y el próximo resumen
 * de las cuentas que ya existían. Sin ella, lo anterior al cambio no avisaría
 * hasta que alguien lo tocara, porque el cron sólo lee por esos dos índices.
 */
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { avisoDeTarea, resumenDeCuenta } from './migrations/avisosPorTarea';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const H = 3_600_000;

describe('la migración de avisos', () => {
  afterEach(() => vi.useRealTimers());

  it('rellena lo que falta, deja lo terminado y no repite trabajo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 7, 16)); // 12:00 en Santo Domingo
    const t = convexTest(schema, modules);
    const as = t.withIdentity(ana);
    const userId = (await as.mutation(api.users.ensure, {})) as Id<'users'>;
    await t.run((ctx) => ctx.db.patch(userId, { timezone: 'America/Santo_Domingo' }));
    await as.mutation(api.settings.update, { theme: 'dark' });
    const system = await as.mutation(api.systems.create, { name: 'K', color: 'blue', templateType: 'project', icon: 'rocket' });
    const viva = await as.mutation(api.tasks.create, { systemId: system.id, title: 'Viva', dueDate: new Date(Date.now() + 5 * H).toISOString() });
    const hecha = await as.mutation(api.tasks.create, { systemId: system.id, title: 'Hecha', dueDate: new Date(Date.now() + 5 * H).toISOString() });
    await as.mutation(api.tasks.toggle, { id: hecha.id });
    // Como si vinieran de antes del cambio: sin nada escrito.
    await t.run(async (ctx) => {
      await ctx.db.patch(viva.id as Id<'tasks'>, { nextReminderAt: undefined });
      const fila = await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', userId)).unique();
      await ctx.db.patch(fila!._id, { nextDigestAt: undefined });
    });

    const parches = await t.run(async (ctx) => {
      const tareas = await ctx.db.query('tasks').collect();
      const fila = (await ctx.db.query('userSettings').collect())[0]!;
      return {
        viva: await avisoDeTarea(ctx, tareas.find((x) => x._id === viva.id)!),
        hecha: await avisoDeTarea(ctx, tareas.find((x) => x._id === hecha.id)!),
        cuenta: await resumenDeCuenta(ctx, fila),
      };
    });
    // 12:00 con vencimiento a las 17:00: el próximo es a las 13:00, cuatro horas antes.
    expect(parches.viva).toEqual({ nextReminderAt: Date.UTC(2026, 9, 7, 17) });
    expect(parches.hecha).toBeUndefined();
    expect(parches.cuenta).toEqual({ nextDigestAt: Date.UTC(2026, 9, 8, 12) });

    await t.run((ctx) => ctx.db.patch(viva.id as Id<'tasks'>, parches.viva!));
    const otraVez = await t.run(async (ctx) => avisoDeTarea(ctx, (await ctx.db.get(viva.id as Id<'tasks'>))!));
    // `t.run` devuelve un `undefined` de primer nivel como `null`.
    expect(otraVez).toBeNull();
  });
});
