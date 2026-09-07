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
