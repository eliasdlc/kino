/**
 * Qué se prueba: que los avisos llegan y siguen llegando. Que varias tareas de
 * una vuelta salen en un solo push, que lo que no salió no se marca como
 * avisado, que el correo entra cuando el push no llega, que una vencida sigue
 * avisando sin tope, y que los botones de la notificación sólo obedecen a un
 * enlace firmado.
 *
 * El defecto que esto sustituye: los avisos salían a medianoche, nada sonaba a
 * la hora de vencer, y una tarea vencida callaba después de dos a catorce
 * avisos. Una recurrente perdía los suyos desde la segunda ocurrencia.
 */

import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { avisosPayload, repartir, TOPE_CORREOS_DIA, type Canales, type Correo, type Payload } from './lib/reparto';
import { firmarAccion } from './lib/firmaAccion';
import type { AvisoDeTarea, Entrega } from './notifications';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };

const H = 3_600_000;
const TZ = 'America/Santo_Domingo';
/** Un reloj local de Santo Domingo (UTC-4) como instante. */
const local = (dia: number, hora: number, min = 0) => Date.UTC(2026, 9, dia, hora + 4, min);
const reloj = (t: number) => {
  const d = new Date(t - 4 * H);
  return `${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const aviso = (n: number, over: Partial<AvisoDeTarea> = {}): AvisoDeTarea => ({
  taskId: `task-${n}` as Id<'tasks'>,
  title: `Tarea ${n}`,
  texto: 'Vence en 2 h',
  vencida: false,
  priority: 'high',
  ...over,
});

const tanda = (over: Partial<Entrega> = {}): Entrega => ({
  userId: 'user-1' as Id<'users'>,
  email: 'ana@usekino.dev',
  correo: true,
  dia: '2026-10-07',
  correosHoy: 0,
  avisos: [],
  recordatorios: [],
  tocaResumen: false,
  resumen: null,
  reparar: [],
  ...over,
});

function canales(push: { intentos: number; entregado: boolean }, correo: boolean | null = true) {
  const enviarPush = vi.fn<(p: Payload) => Promise<{ intentos: number; entregado: boolean }>>().mockResolvedValue(push);
  const enviarCorreo = vi.fn<(c: Correo) => Promise<boolean>>().mockResolvedValue(Boolean(correo));
  const c: Canales = {
    push: enviarPush,
    correo: correo === null ? null : enviarCorreo,
    firmar: async (taskId) => ({ endpoint: 'https://site/push/accion', token: `tok-${taskId}` }),
    appUrl: 'https://www.usekino.dev',
  };
  return { c, enviarPush, enviarCorreo };
}

describe('el reparto de una tanda', () => {
  it('cinco tareas de una vuelta salen en un solo push, lo vencido primero', async () => {
    const { c, enviarPush } = canales({ intentos: 1, entregado: true });
    const avisos = [1, 2, 3, 4].map((n) => aviso(n)).concat(aviso(5, { vencida: true, texto: 'Venció hace 3 h' }));

    const { registro, notified } = await repartir(tanda({ avisos }), c);

    expect(enviarPush).toHaveBeenCalledTimes(1);
    expect(enviarPush.mock.calls[0]![0]).toMatchObject({ title: '5 tareas sin terminar · 1 vencida' });
    expect(enviarPush.mock.calls[0]![0].body.startsWith('Venció hace 3 h: Tarea 5')).toBe(true);
    expect(registro.avisados).toHaveLength(5);
    expect(notified).toBe(5);
  });

  it('una sola tarea lleva su estado de título, su enlace y los botones', async () => {
    const { c, enviarPush } = canales({ intentos: 1, entregado: true });
    await repartir(tanda({ avisos: [aviso(1)] }), c);
    expect(enviarPush.mock.calls[0]![0]).toEqual({
      title: 'Vence en 2 h',
      body: 'Tarea 1',
      url: '/tasks?tarea=task-1',
      tag: 'tarea-task-1',
      accion: { endpoint: 'https://site/push/accion', token: 'tok-task-1' },
    });
  });

  it('si el push no llega, sale por correo', async () => {
    const { c, enviarCorreo } = canales({ intentos: 1, entregado: false });
    const { registro } = await repartir(tanda({ avisos: [aviso(1)] }), c);
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(enviarCorreo.mock.calls[0]![0].asunto).toBe('Vence en 2 h: Tarea 1');
    expect(registro).toMatchObject({ avisados: ['task-1'], reintentar: [], correos: 1 });
  });

  it('con canal pero sin entrega, no se marca: se reintenta', async () => {
    const { c } = canales({ intentos: 2, entregado: false }, false);
    const { registro, notified } = await repartir(tanda({ avisos: [aviso(1), aviso(2)] }), c);
    expect(registro.avisados).toEqual([]);
    expect(registro.reintentar).toEqual(['task-1', 'task-2']);
    expect(notified).toBe(0);
  });

  it('sin ningún canal posible avanza, para no releerla cada quince minutos', async () => {
    const { c } = canales({ intentos: 0, entregado: false }, null);
    const { registro } = await repartir(tanda({ avisos: [aviso(1)] }), c);
    expect(registro).toMatchObject({ avisados: ['task-1'], reintentar: [] });
  });

  it('el correo de respaldo tiene tope diario', async () => {
    const { c, enviarCorreo } = canales({ intentos: 0, entregado: false });
    const { registro } = await repartir(tanda({ avisos: [aviso(1)], correosHoy: TOPE_CORREOS_DIA }), c);
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(registro.reintentar).toEqual(['task-1']);
  });

  it('con el correo apagado por la persona, no se usa aunque el deployment pueda', async () => {
    const { c, enviarCorreo } = canales({ intentos: 0, entregado: false });
    const { registro } = await repartir(tanda({ avisos: [aviso(1)], correo: false }), c);
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(registro.avisados).toEqual(['task-1']);
  });

  it('el resumen sale por push y por correo, y no gasta del tope', async () => {
    const { c, enviarPush, enviarCorreo } = canales({ intentos: 1, entregado: true });
    const resumen = { vencidas: [], hoy: [{ id: 't', title: 'Entrega', dueDate: 0, priority: 'high' as const }], manana: [], proximas: [] };
    const { registro } = await repartir(tanda({ resumen, tocaResumen: true }), c);
    expect(enviarPush.mock.calls[0]![0]).toMatchObject({ title: '1 para hoy', body: 'Entrega' });
    expect(enviarCorreo.mock.calls[0]![0].asunto).toBe('Tu día: 1 para hoy');
    expect(registro.correos).toBe(0);
  });

  it('ningún texto pone a Kino de sujeto', () => {
    const p = avisosPayload([aviso(1), aviso(2)]);
    expect(`${p.title} ${p.body}`).not.toContain('Kino');
  });
});

describe('las suscripciones push', () => {
  const suscripcion = { endpoint: 'https://push.example/ana', keys: { auth: 'a', p256dh: 'p' } };

  it('la cuenta de al lado no puede pisar una suscripción ajena con su endpoint', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const asBeto = t.withIdentity(beto);
    const anaId = await asAna.mutation(api.users.ensure, {});
    await asBeto.mutation(api.users.ensure, {});
    await asAna.mutation(api.notifications.subscribe, suscripcion);

    await expect(asBeto.mutation(api.notifications.subscribe, { ...suscripcion, keys: { auth: 'x', p256dh: 'y' } })).rejects.toThrow();

    const filas = await t.run((ctx) => ctx.db.query('pushSubscriptions').collect());
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ userId: anaId, authKey: 'a' });
  });

  it('desuscribirse con el endpoint de otra cuenta no la apaga', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const asBeto = t.withIdentity(beto);
    await asAna.mutation(api.users.ensure, {});
    await asBeto.mutation(api.users.ensure, {});
    await asAna.mutation(api.notifications.subscribe, suscripcion);

    await asBeto.mutation(api.notifications.unsubscribe, { endpoint: suscripcion.endpoint });

    expect(await t.run((ctx) => ctx.db.query('pushSubscriptions').collect())).toHaveLength(1);
  });

  it('la propia cuenta sí renueva sus claves sobre el mismo endpoint', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.users.ensure, {});
    await asAna.mutation(api.notifications.subscribe, suscripcion);

    await asAna.mutation(api.notifications.subscribe, { ...suscripcion, keys: { auth: 'nueva', p256dh: 'nueva' } });

    const filas = await t.run((ctx) => ctx.db.query('pushSubscriptions').collect());
    expect(filas).toHaveLength(1);
    expect(filas[0]!.authKey).toBe('nueva');
  });
});


// ── De punta a punta, contra la base ───────────────────────────────────────

async function escenario(t: ReturnType<typeof convexTest>, conPush = true) {
  const as = t.withIdentity(ana);
  const userId = (await as.mutation(api.users.ensure, {})) as Id<'users'>;
  await t.run((ctx) => ctx.db.patch(userId, { timezone: TZ }));
  await as.mutation(api.settings.update, { theme: 'system' });
  const system = await as.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  if (conPush) await as.mutation(api.notifications.subscribe, { endpoint: 'https://push.example/ana', keys: { auth: 'a', p256dh: 'p' } });
  return { as, userId, systemId: system.id };
}

/**
 * Una vuelta del cron sin red: lee lo pendiente, lo da por entregado y lo
 * registra, que es lo que hace `pushSend` cuando todo llega.
 */
async function vuelta(t: ReturnType<typeof convexTest>, log: string[]) {
  const { entregas, limpiar, descartar } = await t.query(internal.notifications.pendientes, {});
  await t.mutation(internal.notifications.limpiar, { tareas: limpiar, recordatorios: descartar });
  for (const e of entregas) {
    for (const a of e.avisos) log.push(`${reloj(Date.now())} ${a.texto}`);
    if (e.resumen) log.push(`${reloj(Date.now())} RESUMEN ${e.resumen.hoy.length}/${e.resumen.manana.length}/${e.resumen.proximas.length}/${e.resumen.vencidas.length}`);
    await t.mutation(internal.notifications.registrar, {
      userId: e.userId,
      avisados: e.avisos.map((a) => a.taskId),
      reintentar: [],
      recordatorios: e.recordatorios.map((r) => r.id),
      tocaResumen: e.tocaResumen,
      reparar: e.reparar,
      dia: e.dia,
      correos: 0,
    });
  }
}

async function simular(t: ReturnType<typeof convexTest>, hasta: number) {
  const log: string[] = [];
  while (Date.now() < hasta) {
    await vuelta(t, log);
    vi.setSystemTime(Date.now() + 15 * 60_000);
  }
  return log;
}

describe('el cron de avisos, de punta a punta', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('una tarea alta: resumen a tres, dos y un día, la recta final y la insistencia sin tope', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(local(1, 10));
    const t = convexTest(schema, modules);
    const { as, systemId } = await escenario(t);
    await as.mutation(api.tasks.create, { systemId, title: 'Entrega', dueDate: new Date(local(7, 17)).toISOString() });

    const log = await simular(t, local(12, 0));

    // El resumen de la mañana la trae a tres, dos y un día, y el día mismo.
    expect(log.filter((l) => l.includes('RESUMEN'))).toEqual([
      '4 08:00 RESUMEN 0/0/1/0',
      '5 08:00 RESUMEN 0/0/1/0',
      '6 08:00 RESUMEN 0/1/0/0',
      '7 08:00 RESUMEN 1/0/0/0',
      '8 08:00 RESUMEN 0/0/0/1',
      '9 08:00 RESUMEN 0/0/0/1',
      '10 08:00 RESUMEN 0/0/0/1',
      '11 08:00 RESUMEN 0/0/0/1',
    ]);
    const avisos = log.filter((l) => !l.includes('RESUMEN'));
    expect(avisos.slice(0, 7)).toEqual([
      '7 11:00 Vence en 6 h',
      '7 13:00 Vence en 4 h',
      '7 15:00 Vence en 2 h',
      '7 16:00 Vence en 1 h',
      '7 17:00 Vence ahora',
      '7 20:00 Venció hace 3 h',
      '8 08:00 Venció hace 15 h',
    ]);
    // Nada de madrugada, y cuatro días después sigue insistiendo.
    expect(avisos.every((l) => { const h = +l.split(' ')[1]!.slice(0, 2); return h >= 7 && h < 22; })).toBe(true);
    expect(avisos.some((l) => l.startsWith('11 '))).toBe(true);
  }, 60_000);

  it('completarla corta los avisos, y una recurrente nace con los suyos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(local(1, 10));
    const t = convexTest(schema, modules);
    const { as, systemId } = await escenario(t);
    const tarea = await as.mutation(api.tasks.create, {
      systemId,
      title: 'Semanal',
      dueDate: new Date(local(7, 17)).toISOString(),
      recurrenceRule: 'FREQ=WEEKLY',
    });
    await as.mutation(api.tasks.toggle, { id: tarea.id });

    const todas = await t.run((ctx) => ctx.db.query('tasks').collect());
    const original = todas.find((x) => x._id === tarea.id)!;
    const siguiente = todas.find((x) => x._id !== tarea.id)!;
    expect(original.nextReminderAt).toBeUndefined();
    expect(reloj(siguiente.nextReminderAt!)).toBe('14 11:00');
  });

  it('cambiar la intensidad en Ajustes recalcula los avisos ya escritos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(local(7, 12));
    const t = convexTest(schema, modules);
    const { as, systemId } = await escenario(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Hoy', dueDate: new Date(local(7, 17)).toISOString() });
    const leer = async () => reloj((await t.run((ctx) => ctx.db.get(tarea.id as Id<'tasks'>)))!.nextReminderAt!);
    expect(await leer()).toBe('7 13:00');

    await as.mutation(api.settings.update, { reminderIntensity: 'low' });
    expect(await leer()).toBe('7 15:00');

    await as.mutation(api.tasks.update, { id: tarea.id, reminderIntensity: 'off' });
    expect((await t.run((ctx) => ctx.db.get(tarea.id as Id<'tasks'>)))!.nextReminderAt).toBeUndefined();
  });

  it('una tarea nueva nace en alta y la fecha la sube a crítica', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(local(7, 12));
    const t = convexTest(schema, modules);
    const { as, systemId } = await escenario(t);
    const lejana = await as.mutation(api.tasks.create, { systemId, title: 'Lejana', dueDate: new Date(local(28, 12)).toISOString() });
    const cerca = await as.mutation(api.tasks.create, { systemId, title: 'Cerca', priority: 'low', dueDate: new Date(local(8, 9)).toISOString() });
    expect(lejana).toMatchObject({ priority: 'high', effectivePriority: 'high', priorityRaised: false });
    expect(cerca).toMatchObject({ priority: 'low', effectivePriority: 'critical', priorityRaised: true });
  });

  it('apagar los avisos deja de leerlos y descarta los recordatorios pendientes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(local(7, 12));
    const t = convexTest(schema, modules);
    const { as, systemId, userId } = await escenario(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Hoy', dueDate: new Date(local(7, 17)).toISOString() });
    await t.run((ctx) =>
      ctx.db.insert('taskReminders', { taskId: tarea.id as Id<'tasks'>, userId, remindAt: local(7, 11), source: 'user', createdAt: local(7, 11) }),
    );
    await as.mutation(api.settings.update, { notificationsEnabled: false });

    const log = await simular(t, local(8, 12));
    expect(log).toEqual([]);
    const recordatorio = (await t.run((ctx) => ctx.db.query('taskReminders').collect()))[0]!;
    expect(recordatorio.sentAt).toBeDefined();
  });
});

describe('los botones de la notificación', () => {
  afterEach(() => vi.unstubAllEnvs());

  async function conTarea() {
    vi.stubEnv('VAPID_PRIVATE_KEY', 'secreto-de-prueba');
    const t = convexTest(schema, modules);
    const { as, systemId } = await escenario(t);
    const tarea = await as.mutation(api.tasks.create, { systemId, title: 'Pagar', dueDate: new Date(Date.now() + 2 * H).toISOString() });
    return { t, taskId: tarea.id as Id<'tasks'> };
  }
  const pulsar = (t: ReturnType<typeof convexTest>, token: string, accion: string) =>
    t.fetch('/push/accion', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ token, accion }) });

  it('«Hecha» con un enlace firmado completa la tarea, firmada por la vía push', async () => {
    const { t, taskId } = await conTarea();
    const res = await pulsar(t, await firmarAccion(taskId, 'secreto-de-prueba', Date.now()), 'hecha');
    expect(res.status).toBe(204);
    const tarea = (await t.run((ctx) => ctx.db.get(taskId)))!;
    expect(tarea).toMatchObject({ status: 'done', completedVia: 'push' });
    expect(tarea.nextReminderAt).toBeUndefined();
  });

  it('«En 1 h» mueve el próximo aviso una hora', async () => {
    const { t, taskId } = await conTarea();
    const antes = Date.now();
    await pulsar(t, await firmarAccion(taskId, 'secreto-de-prueba', antes), 'posponer');
    const tarea = (await t.run((ctx) => ctx.db.get(taskId)))!;
    expect(tarea.status).not.toBe('done');
    expect(tarea.nextReminderAt! - antes).toBeGreaterThanOrEqual(H);
  });

  it('un enlace firmado con otro secreto, o caducado, no hace nada', async () => {
    const { t, taskId } = await conTarea();
    expect((await pulsar(t, await firmarAccion(taskId, 'otro-secreto', Date.now()), 'hecha')).status).toBe(403);
    expect((await pulsar(t, await firmarAccion(taskId, 'secreto-de-prueba', Date.now() - 8 * 24 * H), 'hecha')).status).toBe(403);
    expect((await t.run((ctx) => ctx.db.get(taskId)))!.status).not.toBe('done');
  });
});
