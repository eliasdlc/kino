/**
 * La cola de una sola interrupción contra la base: qué candidato existe de
 * verdad hoy, qué recuerda el servidor de lo que ya mostró, y que el empuje de
 * Bandeja no gasta la apertura del día. El orden entre las siete clases se
 * prueba par a par en `convex/lib/today/queue.test.ts`, sin base delante.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { DIAS_ANTES_DE_CEDER } from './lib/today/queue';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const MS_POR_DIA = 86_400_000;

type Weekday = Doc<'userSettings'>['weeklyReviewDay'];
const SEMANA: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** El día de la semana de hoy en UTC, que es la zona a la que se fija la cuenta. */
const hoyWeekday = (): Weekday => SEMANA[(new Date().getUTCDay() + 6) % 7]!;
const otroWeekday = (): Weekday => SEMANA.find((dia) => dia !== hoyWeekday())!;

async function seed({ reviewDay = otroWeekday() }: { reviewDay?: Weekday } = {}) {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run(async (ctx) => {
    await ctx.db.patch(userId, { timezone: 'UTC' });
    await ctx.db.insert('userSettings', {
      userId,
      onboardingVersion: 1,
      weeklyReviewDay: reviewDay,
      dailyResetTime: '00:00',
      dailyEnergyLimit: 50,
      focusTimeoutHours: 3,
      theme: 'system',
      notificationsEnabled: true,
      createdAt: 1,
      updatedAt: 1,
    });
    return ctx.db.insert('systems', {
      userId,
      createdBy: userId,
      createdVia: 'session',
      name: 'Inbox',
      color: 'blue',
      templateType: 'inbox',
      icon: 'inbox',
      isActive: true,
      isInbox: true,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    });
  });
  return { t, asAna, userId, systemId };
}

/** Una tarea con la fecha límite pasada, que es lo que el ritual tiene que repartir. */
async function conVencida(asAna: Awaited<ReturnType<typeof seed>>['asAna'], systemId: string) {
  const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Entregar el informe' });
  await asAna.mutation(api.tasks.update, { id: task.id, dueDate: new Date(Date.now() - 3 * MS_POR_DIA).toISOString() });
  return task;
}

describe('la interrupción del día', () => {
  it('sin candidatos no devuelve nada, en vez de un hueco', async () => {
    const { asAna, systemId } = await seed();
    await conVencida(asAna, systemId);
    // Hay vencidas, pero hoy no es el día del ritual: nada que preguntar.
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('el ritual entra su día y sólo si hay algo vencido que repartir', async () => {
    const { asAna, systemId } = await seed({ reviewDay: hoyWeekday() });
    await asAna.mutation(api.tasks.create, { systemId, title: 'Sin vencer' });
    expect(await asAna.query(api.today.interruption, {})).toBeNull();

    await conVencida(asAna, systemId);
    expect(await asAna.query(api.today.interruption, {})).toMatchObject({ kind: 'ritual', payload: { vencidas: 1 } });
  });

  it('acusar recibo la retira y no vuelve', async () => {
    const { asAna, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);
    const elegida = await asAna.query(api.today.interruption, {});
    expect(elegida).not.toBeNull();

    await asAna.mutation(api.today.acknowledge, { kind: 'ritual', key: elegida!.key });
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('mostrada hace más de dos días sin acuse cede el turno y deja de ocupar la apertura', async () => {
    const { t, asAna, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);
    const elegida = (await asAna.query(api.today.interruption, {}))!;

    await asAna.mutation(api.today.markSurfaced, { kind: 'ritual', key: elegida.key });
    expect(await asAna.query(api.today.interruption, {})).toMatchObject({ key: elegida.key, surfacedAt: expect.any(Number) });

    // Envejece la fila de lo mostrado, no el candidato: la caducidad de la cola
    // es por tiempo mostrado y no por la edad de lo que propone.
    await t.run(async (ctx) => {
      const fila = (await ctx.db.query('interruptions').first())!;
      await ctx.db.patch(fila._id, { surfacedAt: Date.now() - (DIAS_ANTES_DE_CEDER * MS_POR_DIA + 1000) });
      return null;
    });
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('mostrarla dos veces no le regala dos días más', async () => {
    const { t, asAna, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);
    const elegida = (await asAna.query(api.today.interruption, {}))!;

    expect(await asAna.mutation(api.today.markSurfaced, { kind: 'ritual', key: elegida.key })).toBe(true);
    const primera = await t.run(async (ctx) => (await ctx.db.query('interruptions').first())!.surfacedAt);
    expect(await asAna.mutation(api.today.markSurfaced, { kind: 'ritual', key: elegida.key })).toBe(false);
    expect(await t.run(async (ctx) => (await ctx.db.query('interruptions').first())!.surfacedAt)).toBe(primera);
  });

  it('ocho capturas en Bandeja no cambian lo que la cola devuelve', async () => {
    const { t, asAna, userId, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);
    const sinBandeja = await asAna.query(api.today.interruption, {});

    await t.run(async (ctx) => {
      for (let i = 0; i < 8; i++) {
        await ctx.db.insert('captures', {
          userId,
          status: 'pending',
          kind: 'text',
          expiresAt: Date.now() + MS_POR_DIA,
          createdAt: Date.now(),
        });
      }
      return null;
    });

    expect(await asAna.query(api.today.interruption, {})).toEqual(sinBandeja);
    expect(sinBandeja).toMatchObject({ kind: 'ritual' });
  });

  it('la interrupción de una persona no se ve desde la cuenta de otra', async () => {
    const { t, asAna, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);

    const beto = t.withIdentity({ subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' });
    await beto.mutation(api.users.ensure, {});
    expect(await beto.query(api.today.interruption, {})).toBeNull();
    expect(await asAna.query(api.today.interruption, {})).not.toBeNull();
  });

  it('el acuse de una persona no retira la interrupción de otra', async () => {
    const { t, asAna, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);
    const elegida = (await asAna.query(api.today.interruption, {}))!;

    const beto = t.withIdentity({ subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' });
    await beto.mutation(api.users.ensure, {});
    await beto.mutation(api.today.acknowledge, { kind: 'ritual', key: elegida.key });

    expect(await asAna.query(api.today.interruption, {})).toMatchObject({ key: elegida.key });
  });
});
