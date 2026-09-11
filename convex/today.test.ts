/**
 * La cola de una sola interrupción contra la base: qué candidato existe de
 * verdad hoy, qué recuerda el servidor de lo que ya mostró, y que el empuje de
 * Bandeja no gasta la apertura del día. El orden entre las siete clases se
 * prueba par a par en `convex/lib/today/queue.test.ts`, sin base delante.
 */
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { DIAS_DE_AUSENCIA, ITEMS_PARA_PROPONER_CARPETA, semanaAnterior } from './today';
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

  it('veinte items en un sistema sin carpetas proponen una, con el sustantivo de su arquetipo', async () => {
    const { t, asAna, userId } = await seed();
    const semestre = await t.run((ctx) =>
      ctx.db.insert('systems', {
        userId,
        createdBy: userId,
        createdVia: 'session',
        name: 'Semestre actual',
        color: 'blue',
        templateType: 'academic',
        icon: 'graduation',
        isActive: true,
        isInbox: false,
        sortOrder: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    for (let i = 0; i < ITEMS_PARA_PROPONER_CARPETA - 1; i++) {
      await asAna.mutation(api.tasks.create, { systemId: semestre, title: `Pendiente ${i + 1}` });
    }
    // Uno por debajo del umbral todavía no propone nada.
    expect(await asAna.query(api.today.interruption, {})).toBeNull();

    await asAna.mutation(api.tasks.create, { systemId: semestre, title: 'La que cruza el umbral' });

    const empuje = await asAna.query(api.today.interruption, {});
    expect(empuje).toMatchObject({
      kind: 'empujeSistema',
      key: semestre,
      // En un sistema académico se propone una clase, no "una carpeta": el
      // sustantivo sale del manifiesto y no de un `if` por tipo.
      payload: { nombre: 'Semestre actual', items: ITEMS_PARA_PROPONER_CARPETA, contenedor: 'clase' },
    });
  });

  it('el empuje pierde contra el ritual, que es tercera prioridad', async () => {
    const { t, asAna, userId, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);
    const semestre = await t.run((ctx) =>
      ctx.db.insert('systems', {
        userId,
        createdBy: userId,
        createdVia: 'session',
        name: 'Semestre actual',
        color: 'blue',
        templateType: 'academic',
        icon: 'graduation',
        isActive: true,
        isInbox: false,
        sortOrder: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    for (let i = 0; i < ITEMS_PARA_PROPONER_CARPETA; i++) {
      await asAna.mutation(api.tasks.create, { systemId: semestre, title: `Pendiente ${i + 1}` });
    }

    // Los dos candidatos existen y la cola sigue devolviendo uno: el de arriba.
    expect(await asAna.query(api.today.interruption, {})).toMatchObject({ kind: 'ritual' });
  });

  it('un sistema que ya organiza con carpetas no recibe la propuesta', async () => {
    const { t, asAna, userId } = await seed();
    const semestre = await t.run(async (ctx) => {
      const id = await ctx.db.insert('systems', {
        userId,
        createdBy: userId,
        createdVia: 'session',
        name: 'Semestre actual',
        color: 'blue',
        templateType: 'academic',
        icon: 'graduation',
        isActive: true,
        isInbox: false,
        sortOrder: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert('folders', {
        userId,
        createdBy: userId,
        createdVia: 'session',
        systemId: id,
        name: 'Cálculo II',
        color: 'blue',
        sortIndex: 0,
        createdAt: 1,
        updatedAt: 1,
      });
      return id;
    });
    for (let i = 0; i < ITEMS_PARA_PROPONER_CARPETA; i++) {
      await asAna.mutation(api.tasks.create, { systemId: semestre, title: `Pendiente ${i + 1}` });
    }

    // Proponer una carpeta a quien ya tiene una es no proponer nada.
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
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

describe('el estado de regreso', () => {
  /** Deja la cuenta como si la visita anterior hubiera sido hace `dias` días. */
  const volviendoTras = (t: ReturnType<typeof convexTest>, userId: Awaited<ReturnType<typeof seed>>['userId'], dias: number) =>
    t.run(async (ctx) => {
      await ctx.db.patch(userId, { lastActiveAt: Date.now(), previousActiveAt: Date.now() - dias * MS_POR_DIA });
      return null;
    });

  it('sin visita anterior, y con una ausencia corta, no hay nada que decir', async () => {
    const { t, asAna, userId } = await seed();
    expect(await asAna.query(api.today.returnNotice, {})).toBeNull();

    await volviendoTras(t, userId, DIAS_DE_AUSENCIA - 1);
    expect(await asAna.query(api.today.returnNotice, {})).toBeNull();
  });

  it('a los siete dias cuenta lo que vencio y lo que se repitio solo, de una consulta real', async () => {
    const { t, asAna, userId, systemId } = await seed();

    // Venció durante la ausencia y sigue sin completarse.
    const vencida = await asAna.mutation(api.tasks.create, { systemId, title: 'Entregar' });
    await asAna.mutation(api.tasks.update, { id: vencida.id, dueDate: new Date(Date.now() - 3 * MS_POR_DIA).toISOString() });
    // Venció antes de irse: no cuenta.
    const vieja = await asAna.mutation(api.tasks.create, { systemId, title: 'Vieja' });
    await asAna.mutation(api.tasks.update, { id: vieja.id, dueDate: new Date(Date.now() - 30 * MS_POR_DIA).toISOString() });
    // Una recurrente completada siembra la siguiente, que firma el sistema.
    const serie = await asAna.mutation(api.tasks.create, {
      systemId,
      title: 'Regar las plantas',
      dueDate: new Date(Date.now() + MS_POR_DIA).toISOString(),
      recurrenceRule: 'FREQ=DAILY',
    });
    await asAna.mutation(api.tasks.toggle, { id: serie.id });

    await volviendoTras(t, userId, 14);
    expect(await asAna.query(api.today.returnNotice, {})).toMatchObject({
      dias: 14,
      vencidas: 1,
      repetidas: 1,
      conEnergia: false,
    });
  });

  it('con un check-in dentro del hueco deja de decir que no hay datos de energia', async () => {
    const { t, asAna, userId } = await seed();
    await volviendoTras(t, userId, 14);
    expect(await asAna.query(api.today.returnNotice, {})).toMatchObject({ conEnergia: false });

    await t.run(async (ctx) => {
      await ctx.db.insert('energyCheckins', {
        userId,
        date: '2026-09-01',
        slot: 'morning',
        currentLevel: 3,
        sleepQuality: 'good',
        createdAt: Date.now() - 5 * MS_POR_DIA,
      });
      return null;
    });
    expect(await asAna.query(api.today.returnNotice, {})).toMatchObject({ conEnergia: true });
  });

  it('no ocupa la interrupcion del dia: si hay linea arriba, salen las dos', async () => {
    const { t, asAna, userId, systemId } = await seed({ reviewDay: hoyWeekday() });
    await conVencida(asAna, systemId);
    await volviendoTras(t, userId, 14);

    expect(await asAna.query(api.today.interruption, {})).toMatchObject({ kind: 'ritual' });
    expect(await asAna.query(api.today.returnNotice, {})).not.toBeNull();
  });

  it('la ausencia de una persona no se lee desde la cuenta de otra', async () => {
    const { t, asAna, userId } = await seed();
    await volviendoTras(t, userId, 14);

    const beto = t.withIdentity({ subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' });
    await beto.mutation(api.users.ensure, {});
    expect(await beto.query(api.today.returnNotice, {})).toBeNull();
    expect(await asAna.query(api.today.returnNotice, {})).not.toBeNull();
  });
});

describe('la linea del lunes', () => {
  /** Deja el digest de la semana que la linea del lunes de hoy citaria. */
  const conDigestDeLaSemanaPasada = (
    t: ReturnType<typeof convexTest>,
    userId: Awaited<ReturnType<typeof seed>>['userId'],
    digest: Record<string, unknown> = { summary: '8 sesiones en 4 dias, sobre kino.', quote: 'la firma vive en el servicio y no en el router' },
  ) =>
    t.run((ctx) =>
      ctx.db.insert('sessionDigests', {
        userId,
        source: 'claude-code',
        externalId: semanaAnterior(Date.now()),
        digest,
        createdAt: Date.now(),
      }),
    );

  /**
   * Un lunes de verdad, para que estos tests corran los siete días de la
   * semana. Sin el reloj fijo sólo probarían los lunes, que es lo mismo que no
   * probar nada de martes a domingo.
   */
  const UN_LUNES = Date.parse('2026-09-07T13:00:00Z');
  const enLunes = () => vi.useFakeTimers({ shouldAdvanceTime: true }).setSystemTime(UN_LUNES);
  afterEach(() => vi.useRealTimers());

  it('cita la semana anterior y no la que empieza hoy', () => {
    // El lunes 7 de septiembre de 2026 cita la semana 36, que acaba de cerrarse.
    expect(semanaAnterior(Date.parse('2026-09-07T09:00:00Z'))).toBe('2026-W36');
    expect(semanaAnterior(Date.parse('2026-01-05T09:00:00Z'))).toBe('2026-W01');
  });

  it('sin digest de esa semana no hay linea, aunque sea lunes', async () => {
    enLunes();
    const { asAna } = await seed();
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('el lunes con digest desaloja al ritual y trae la cita', async () => {
    enLunes();
    const { t, asAna, userId, systemId } = await seed({ reviewDay: 'mon' });
    await conVencida(asAna, systemId);
    await conDigestDeLaSemanaPasada(t, userId);

    const elegida = await asAna.query(api.today.interruption, {});
    expect(elegida).toMatchObject({
      kind: 'lunes',
      payload: { quote: 'la firma vive en el servicio y no en el router' },
    });
  });

  it('convertirla en tarea escribe digestId y retira la linea de una vez', async () => {
    enLunes();
    const { t, asAna, userId } = await seed();
    await asAna.mutation(api.systems.setup, {});
    const digestId = await conDigestDeLaSemanaPasada(t, userId);
    const elegida = (await asAna.query(api.today.interruption, {}))!;

    const creada = await asAna.mutation(api.today.taskFromDigest, {
      key: elegida.key,
      title: 'Terminar la firma del cierre',
      digestId,
    });

    // La tarea lleva de que digest salio: es lo que la puerta de muerte cuenta.
    const task = (await t.run((ctx) => ctx.db.get(creada.id)))!;
    expect(task.digestId).toBe(digestId);
    expect(task.title).toBe('Terminar la firma del cierre');
    // Y la linea se fue en la misma mutacion, sin un segundo acuse.
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('el digest de otra persona no se puede citar ni convertir', async () => {
    enLunes();
    const { t, asAna, userId } = await seed();
    await asAna.mutation(api.systems.setup, {});
    const digestId = await conDigestDeLaSemanaPasada(t, userId);

    const beto = t.withIdentity({ subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' });
    await beto.mutation(api.users.ensure, {});
    await beto.mutation(api.systems.setup, {});
    expect(await beto.query(api.today.interruption, {})).toBeNull();
    await expect(
      beto.mutation(api.today.taskFromDigest, { key: semanaAnterior(Date.now()), title: 'Ajena', digestId }),
    ).rejects.toThrow();
  });
});
