/**
 * Qué se prueba: que una tanda de avisos sale agrupada, que lo que no se
 * entregó no queda marcado como avisado, y que una cuenta no puede tocar la
 * suscripción de otra.
 *
 * Los dos primeros son el defecto vivo: cinco tareas escaladas producían cinco
 * notificaciones seguidas, y la quinta se marcaba como avisada aunque su push
 * hubiera sido rechazado, con lo que perdía su reintento para siempre.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { escalationPayload, repartir, type Delivery, type Payload } from './lib/reparto';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };

const tarea = (n: number, priority = 'high') => ({ id: `task-${n}` as Id<'tasks'>, title: `Tarea ${n}`, priority });

const tanda = (over: Partial<Delivery> = {}): Delivery => ({
  userId: 'user-1' as Id<'users'>,
  dueToday: [],
  dueTomorrow: [],
  reminders: [],
  escalations: [],
  ...over,
});

describe('el reparto de una tanda', () => {
  it('cinco tareas escaladas producen un solo aviso, no cinco', async () => {
    const send = vi.fn<(payload: Payload) => Promise<boolean>>().mockResolvedValue(true);
    const escalations = [1, 2, 3, 4, 5].map((n) => tarea(n));

    const { delivered, notified } = await repartir(tanda({ escalations }), send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ title: '5 tareas sin completar' });
    expect(delivered.escalations).toHaveLength(5);
    expect(notified).toBe(5);
  });

  it('una tarea cuyo push fue rechazado no queda marcada, y el próximo ciclo la reintenta', async () => {
    const send = vi.fn<(payload: Payload) => Promise<boolean>>().mockResolvedValue(false);

    const { delivered, notified } = await repartir(tanda({ escalations: [tarea(1), tarea(2)] }), send);

    expect(delivered.escalations).toEqual([]);
    expect(notified).toBe(0);
  });

  it('lo que sí salió se marca aunque otra parte de la tanda fallara', async () => {
    // El primer envío es el de «vence hoy» y se rechaza; el de las escaladas sí sale.
    const send = vi.fn<(payload: Payload) => Promise<boolean>>().mockResolvedValue(true).mockResolvedValueOnce(false);

    const { delivered } = await repartir(
      tanda({ dueToday: [{ id: 'task-9' as Id<'tasks'>, title: 'Vence' }], escalations: [tarea(1)] }),
      send,
    );

    expect(delivered.dueToday).toEqual([]);
    expect(delivered.escalations).toEqual(['task-1']);
  });

  it('el aviso nombra la más urgente y no pone a Kino de sujeto', () => {
    const payload = escalationPayload([tarea(1, 'low'), tarea(2, 'critical'), tarea(3, 'medium')]);

    expect(payload.title).toBe('3 tareas sin completar');
    expect(payload.body).toBe('Tarea 2 y 2 tareas más');
    expect(payload.title.startsWith('3')).toBe(true);
    expect(`${payload.title} ${payload.body}`).not.toContain('Kino');
  });

  it('una sola tarea escalada se nombra en singular', () => {
    expect(escalationPayload([tarea(1)])).toMatchObject({ title: '1 tarea sin completar', body: 'Tarea 1' });
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

/**
 * Qué se prueba: que acotar lo que el cron lee no le quita nada de lo que
 * tenía que entregar.
 *
 * `pendingDeliveries` corre cada quince minutos y antes traía todas las tareas
 * vivas de cada suscrito para quedarse con las de dos días. Ahora lee por rango
 * de vencimiento, y el riesgo de ese cambio es concreto: un recordatorio puesto
 * para hoy sobre una tarea que vence el mes que viene está fuera del rango, y
 * perderlo sería un defecto invisible hasta que alguien no recibe su aviso.
 */
describe('lo que el cron de recordatorios lee', () => {
  const DIA = 86_400_000;

  async function escenario(t: ReturnType<typeof convexTest>) {
    const as = t.withIdentity(ana);
    const userId = await as.mutation(api.users.ensure, {});
    const system = await as.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
    await as.mutation(api.notifications.subscribe, { endpoint: 'https://push.example/ana', keys: { auth: 'a', p256dh: 'p' } });

    const lejana = await as.mutation(api.tasks.create, { systemId: system.id, title: 'Vence el mes que viene' });
    const sinFecha = await as.mutation(api.tasks.create, { systemId: system.id, title: 'Sin fecha' });
    const vencida = await as.mutation(api.tasks.create, { systemId: system.id, title: 'Vencida hace diez dias' });

    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.patch(lejana.id as Id<'tasks'>, { dueDate: now + 30 * DIA });
      await ctx.db.patch(vencida.id as Id<'tasks'>, { dueDate: now - 10 * DIA, notifiedDueDay: true, priority: 'high', reminderCount: 0 });
      // El recordatorio vive en su propio calendario: apunta a la tarea lejana
      // y ya llegó su hora.
      await ctx.db.insert('taskReminders', {
        taskId: lejana.id as Id<'tasks'>,
        userId: userId as Id<'users'>,
        remindAt: now - 1_000,
        source: 'user',
        createdAt: now,
      });
    });

    return { userId, lejana: lejana.id as Id<'tasks'>, sinFecha: sinFecha.id as Id<'tasks'>, vencida: vencida.id as Id<'tasks'> };
  }

  it('el rango deja fuera la que no tiene fecha y la que vence dentro de un mes', async () => {
    const t = convexTest(schema, modules);
    const { userId, vencida } = await escenario(t);

    const leidas = await t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_user_alive_due', (q) =>
          q.eq('userId', userId as Id<'users'>).eq('deletedAt', undefined).gte('dueDate', 0).lte('dueDate', Date.now() + 3 * DIA),
        )
        .collect(),
    );

    expect(leidas.map((x) => x._id)).toEqual([vencida]);
  });

  it('el recordatorio de una tarea lejana sale igual, que es lo que el rango podria haberse llevado', async () => {
    const t = convexTest(schema, modules);
    await escenario(t);

    const { internal } = await import('./_generated/api');
    const entregas = await t.query(internal.notifications.pendingDeliveries, {});

    expect(entregas).toHaveLength(1);
    expect(entregas[0]!.reminders.map((r: { taskTitle: string }) => r.taskTitle)).toEqual(['Vence el mes que viene']);
  });

  it('la vencida sigue escalando y la que no tiene fecha no aparece por ningun lado', async () => {
    const t = convexTest(schema, modules);
    const { sinFecha } = await escenario(t);

    const { internal } = await import('./_generated/api');
    const [entrega] = await t.query(internal.notifications.pendingDeliveries, {});

    expect(entrega!.escalations.map((e: { title: string }) => e.title)).toEqual(['Vencida hace diez dias']);
    const todos = [...entrega!.dueToday, ...entrega!.dueTomorrow, ...entrega!.escalations].map((x: { id: string }) => x.id);
    expect(todos).not.toContain(sinFecha);
  });

  it('un recordatorio ya enviado no vuelve a salir', async () => {
    const t = convexTest(schema, modules);
    await escenario(t);
    await t.run(async (ctx) => {
      for (const r of await ctx.db.query('taskReminders').collect()) await ctx.db.patch(r._id, { sentAt: Date.now() });
    });

    const { internal } = await import('./_generated/api');
    const entregas = await t.query(internal.notifications.pendingDeliveries, {});

    expect(entregas.flatMap((e: { reminders: unknown[] }) => e.reminders)).toEqual([]);
  });
});
