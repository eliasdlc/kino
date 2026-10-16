import { convexTest } from 'convex-test';
import { afterEach, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const { sendNotification, setVapidDetails } = vi.hoisted(() => ({ sendNotification: vi.fn(), setVapidDetails: vi.fn() }));
vi.mock('web-push', () => ({ default: { setVapidDetails, sendNotification } }));
const modules = import.meta.glob('./**/*.*s');

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('reports the rejected device separately when another push is accepted', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private');
  vi.stubEnv('RESEND_API_KEY', '');
  const t = convexTest(schema, modules);
  const user = t.withIdentity({ subject: 'push-test', email: 'prueba@usekino.dev' });
  const userId = await user.mutation(api.users.ensure, {});
  for (const device of ['desktop', 'phone']) {
    await user.mutation(api.notifications.subscribe, { endpoint: `https://fixture.invalid/${device}`, keys: { auth: 'a', p256dh: 'p' } });
  }
  sendNotification.mockResolvedValueOnce({ statusCode: 201 }).mockRejectedValueOnce(Object.assign(new Error('fixture'), { statusCode: 503 }));
  const result = await t.action(internal.pushSend.enviarPrueba, { userId });
  expect(result).toMatchObject({ dispositivos: 2, aceptados: 1, fallidos: 1, push: true });
});

it('reports and removes expired subscriptions without counting them as accepted', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private');
  vi.stubEnv('RESEND_API_KEY', '');
  const t = convexTest(schema, modules);
  const user = t.withIdentity({ subject: 'push-test', email: 'prueba@usekino.dev' });
  const userId = await user.mutation(api.users.ensure, {});
  await user.mutation(api.notifications.subscribe, { endpoint: 'https://fixture.invalid/expired', keys: { auth: 'a', p256dh: 'p' } });
  sendNotification.mockRejectedValueOnce(Object.assign(new Error('fixture'), { statusCode: 410 }));
  expect(await t.action(internal.pushSend.enviarPrueba, { userId })).toMatchObject({ aceptados: 0, fallidos: 1, caducados: 1 });
  expect(await t.run(ctx => ctx.db.query('pushSubscriptions').collect())).toEqual([]);
});

it('without both VAPID keys push counts as unconfigured and nothing is sent', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public');
  vi.stubEnv('VAPID_PRIVATE_KEY', '');
  vi.stubEnv('RESEND_API_KEY', '');
  const t = convexTest(schema, modules);
  const user = t.withIdentity({ subject: 'push-test', email: 'prueba@usekino.dev' });
  const userId = await user.mutation(api.users.ensure, {});
  await user.mutation(api.notifications.subscribe, { endpoint: 'https://fixture.invalid/phone', keys: { auth: 'a', p256dh: 'p' } });
  expect(await t.action(internal.pushSend.enviarPrueba, { userId })).toMatchObject({ pushConfigurado: false, push: false, dispositivos: 0 });
  expect(await t.action(internal.pushSend.sendTaskReminders, {})).toMatchObject({ push: false });
  expect(setVapidDetails).not.toHaveBeenCalled();
  expect(sendNotification).not.toHaveBeenCalled();

  vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private');
  expect(await t.action(internal.pushSend.enviarPrueba, { userId })).toMatchObject({ pushConfigurado: true });
  expect(setVapidDetails).toHaveBeenCalledWith('mailto:admin@kino.app', 'fixture-public', 'fixture-private');
});
