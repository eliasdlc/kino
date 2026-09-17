import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { espiar, type Cuenta } from '@/shared/testing/espia';
import { activosHoy } from './scheduler';
import crons from './crons';
import schema from './schema';
import { userToday } from './lib/time';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const bea = { subject: 'user_bea', email: 'bea@usekino.dev', name: 'Bea' };
const DAY_MS = 86_400_000;

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const anaId = await asAna.mutation(api.users.ensure, {});
  const beaId = await t.withIdentity(bea).mutation(api.users.ensure, {});
  await t.run(async (ctx) => {
    for (const userId of [anaId, beaId]) {
      await ctx.db.insert('userEnergyProfile', {
        userId, chronotype: 'morning', sleepTypicalHours: 7, availableHoursPerDay: 8, energyFloor: 20,
        rechargePresets: [], learnedCurve: [], learningAlpha: 0, createdAt: 1, updatedAt: 1,
      });
    }
  });
  return { t, asAna, anaId, beaId };
}

describe('crons', () => {
  it('registra las tres tareas con su cadencia', () => {
    const registered = crons.crons;
    expect(Object.keys(registered).sort()).toEqual(['daily-snapshot', 'podas-diarias', 'task-reminders']);
    expect(registered['daily-snapshot']!.schedule.type).toBe('daily');
    expect(registered['task-reminders']!.schedule.type).toBe('interval');
    expect(registered['podas-diarias']!.schedule.type).toBe('daily');
  });
});

describe('daily-snapshot', { timeout: 20_000 }, () => {
  it('sólo toca a quien hizo check-in hoy, y deja constancia en la bitácora', async () => {
    const { t, asAna, anaId, beaId } = await seed();
    await asAna.mutation(api.energy.createCheckin, { currentLevel: 70, slot: 'morning' });

    const result = await t.action(internal.scheduler.dailySnapshot, {});
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    // Su propia fila sigue abierta mientras vigila, así que la primera vuelta se
    // cuenta a sí misma como ausente; los recordatorios aún no han corrido nunca.
    expect(result.staleCrons).toEqual(['daily-snapshot', 'task-reminders']);

    const tz = (await t.run((ctx) => ctx.db.get(anaId)))!.timezone;
    const yesterday = userToday(tz, Date.now() - DAY_MS);
    const snapshots = await t.run((ctx) => ctx.db.query('behaviorSnapshots').collect());
    expect(snapshots.map((s) => [s.userId, s.date])).toEqual([[anaId, yesterday]]);
    expect(snapshots.some((s) => s.userId === beaId)).toBe(false);

    const runs = await t.run((ctx) => ctx.db.query('cronRuns').collect());
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ job: 'daily-snapshot', ok: true, result: { processed: 1 } });
    expect(runs[0]!.finishedAt).toBeDefined();
  });

  it('la segunda vuelta no duplica el snapshot y poda lo de hace más de un mes', async () => {
    const { t, asAna } = await seed();
    await asAna.mutation(api.energy.createCheckin, { currentLevel: 70, slot: 'morning' });
    await t.run(async (ctx) => {
      await ctx.db.insert('cronRuns', { job: 'task-reminders', startedAt: Date.now() - 40 * DAY_MS, finishedAt: Date.now() - 40 * DAY_MS, ok: true });
    });

    const first = await t.action(internal.scheduler.dailySnapshot, {});
    expect(first.prunedCronRuns).toBe(1);
    const second = await t.action(internal.scheduler.dailySnapshot, {});
    expect(second.processed).toBe(1);
    expect(second.prunedCronRuns).toBe(0);
    // Con la primera vuelta ya cerrada en verde, sólo los recordatorios siguen callados.
    expect(second.staleCrons).toEqual(['task-reminders']);
    expect(await t.run((ctx) => ctx.db.query('behaviorSnapshots').collect())).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.query('cronRuns').collect())).map((r) => r.job)).toEqual(['daily-snapshot', 'daily-snapshot']);
  });
});

describe('cronRuns', () => {
  it('una ejecución que falla queda cerrada con su error y no cuenta como éxito', async () => {
    const { t } = await seed();
    const id = await t.mutation(internal.cronRuns.open, { job: 'task-reminders' });
    await t.mutation(internal.cronRuns.close, { id, ok: false, error: 'boom' });
    const last = await t.query(internal.cronRuns.lastSuccesses, {});
    expect(last).toEqual([
      { job: 'daily-snapshot', at: null },
      { job: 'task-reminders', at: null },
    ]);
    expect((await t.run((ctx) => ctx.db.get(id)))!.error).toBe('boom');
  });
});

/**
 * Qué se prueba: lo que la lista diaria de usuarios activos **lee** para
 * responderse, no sólo lo que devuelve.
 *
 * Dos criterios. Que el conjunto de activos es el mismo que salía de recorrer
 * la tabla de usuarios entera, zonas horarias incluidas. Y que lo que abre para
 * conseguirlo no crece con las cuentas registradas: la restricción 9 de
 * AGENTS.md acota lo que una query lee, y este cron corría cada noche sobre
 * `users` sin índice.
 *
 * La medida se cuenta, no se afirma: `espiar` envuelve el `db` y suma consultas
 * y documentos por separado. El instante es fijo para que los días candidatos y
 * los números no dependan de cuándo corra la batería.
 */

/** Mediodía UTC: las zonas del mundo caen en dos días, 06-15 y 06-16. */
const MEDIODIA = Date.UTC(2026, 5, 15, 12, 0, 0);
const SANTO_DOMINGO = 'America/Santo_Domingo';
/** UTC+14 y UTC-12, los dos extremos: para uno ya es 06-16 y para el otro medianoche del 06-15. */
const MAS_CATORCE = 'Pacific/Kiritimati';
const MENOS_DOCE = 'Etc/GMT+12';

/**
 * Cincuenta cuentas de las que cinco hicieron check-in hoy. La sexta es la que
 * hace que la medida no se lea sola: tiene check-in con fecha del 06-16, que es
 * hoy en Kiritimati y no en su zona, así que se lee y se descarta.
 */
async function sembrarCuentas(t: ReturnType<typeof convexTest>) {
  const zonas = new Map([[7, MAS_CATORCE], [13, MENOS_DOCE]]);
  const conCheckin = new Map([
    [3, '2026-06-15'], [7, '2026-06-16'], [13, '2026-06-15'], [21, '2026-06-15'], [44, '2026-06-15'],
    // El distractor: su hoy es el 06-15, su check-in dice 06-16.
    [5, '2026-06-16'],
  ]);
  return t.run(async (ctx) => {
    const activos: Id<'users'>[] = [];
    for (let i = 0; i < 50; i++) {
      const userId = await ctx.db.insert('users', {
        email: `cuenta-${i}@usekino.dev`, name: `Cuenta ${i}`, onboardingCompleted: true,
        status: 'active', timezone: zonas.get(i) ?? SANTO_DOMINGO, createdAt: MEDIODIA, updatedAt: MEDIODIA,
      });
      const date = conCheckin.get(i);
      if (!date) continue;
      await ctx.db.insert('energyCheckins', {
        userId, date, slot: 'morning', currentLevel: 70, sleepQuality: 'partial', createdAt: MEDIODIA,
      });
      if (i !== 5) activos.push(userId);
    }
    return activos;
  });
}

/** Una cuenta con sus check-in, cada uno con la fecha que se le diga. */
async function cuentaCon(t: ReturnType<typeof convexTest>, email: string, timezone: string, fechas: string[]) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      email, name: email, onboardingCompleted: true, status: 'active', timezone,
      createdAt: MEDIODIA, updatedAt: MEDIODIA,
    });
    for (const date of fechas) {
      for (const slot of ['morning', 'afternoon', 'evening'] as const) {
        await ctx.db.insert('energyCheckins', {
          userId, date, slot, currentLevel: 70, sleepQuality: 'partial', createdAt: MEDIODIA,
        });
      }
    }
    return userId;
  });
}

describe('activeUserIds', { timeout: 20_000 }, () => {
  it('lee por los check-in del día, no por la tabla de cuentas', async () => {
    const t = convexTest(schema, modules);
    const esperados = await sembrarCuentas(t);
    const cuenta: Cuenta = { consultas: 0, documentos: 0 };

    const ids = await t.run((ctx) => activosHoy({ ...ctx, db: espiar(ctx.db, cuenta) }, MEDIODIA));

    // El mismo conjunto que salía de recorrer `users`: los cinco con check-in
    // de su propio hoy, sin el que lo tiene de otro día.
    expect(new Set(ids)).toEqual(new Set(esperados));
    // Dos días candidatos, una consulta cada uno. Los documentos son los seis
    // check-in de esos dos días más los seis dueños que hay que mirar para
    // confirmar su zona; ni uno por cada cuenta registrada.
    expect(cuenta).toEqual({ consultas: 2, documentos: 12 });
  });

  /**
   * Un día candidato no es sólo de quien lo está viviendo: guarda también el
   * check-in de ayer de quien ya pasó al día siguiente. Si el presupuesto de
   * lectura se contara en personas, esas filas lo gastarían y dejarían fuera a
   * un activo de verdad.
   */
  it('el check-in de ayer de otra zona no deja fuera a quien sí está en ese día', async () => {
    const t = convexTest(schema, modules);
    // 04:00Z: en Santo Domingo ya es el 15, en Ciudad de México todavía el 14.
    const madrugada = Date.UTC(2026, 5, 15, 4, 0, 0);
    // Cincuenta y una cuentas con tres check-in del 14, que para ellas es ayer:
    // ciento cincuenta y tres filas en el día candidato que no son candidatas.
    for (let i = 0; i < 51; i++) {
      await cuentaCon(t, `ayer-${i}@usekino.dev`, SANTO_DOMINGO, ['2026-06-14']);
    }
    // Y una, creada la última para que su id ordene detrás de todas, para la
    // que el 14 sí es hoy.
    const mexico = await cuentaCon(t, 'hoy@usekino.dev', 'America/Mexico_City', ['2026-06-14']);

    expect(await t.run((ctx) => activosHoy(ctx, madrugada))).toEqual([mexico]);
  });

  /** Entre las 10:00 y las 11:59 UTC el mundo está repartido en tres fechas. */
  it('con tres fechas candidatas encuentra a los tres husos', async () => {
    const t = convexTest(schema, modules);
    const media = Date.UTC(2026, 5, 15, 11, 0, 0);
    const atrasado = await cuentaCon(t, 'atrasado@usekino.dev', MENOS_DOCE, ['2026-06-14']);
    const medio = await cuentaCon(t, 'medio@usekino.dev', SANTO_DOMINGO, ['2026-06-15']);
    const adelantado = await cuentaCon(t, 'adelantado@usekino.dev', MAS_CATORCE, ['2026-06-16']);
    // El distractor: su hoy es el 15 y su check-in dice 16.
    await cuentaCon(t, 'distractor@usekino.dev', SANTO_DOMINGO, ['2026-06-16']);

    const cuenta: Cuenta = { consultas: 0, documentos: 0 };
    const ids = await t.run((ctx) => activosHoy({ ...ctx, db: espiar(ctx.db, cuenta) }, media));

    expect(new Set(ids)).toEqual(new Set([atrasado, medio, adelantado]));
    // Tres fechas, tres consultas: una por día candidato y ninguna más.
    expect(cuenta.consultas).toBe(3);
  });
});
