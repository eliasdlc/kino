/**
 * Criterio: una suscripción del navegador sólo se muestra activa después
 * de registrarse en Convex. Un rechazo conserva un estado de error y permite
 * reintentar; sin clave pública no se pide permiso ni se espera al worker.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderWithProviders, stubMutation, stubMutationError } from '@/shared/testing/render';
import { toast } from 'sonner';
import { useMantenerAvisos, useProbarAvisos, usePushNotifications } from './notifications.hooks';

const endpoint = 'https://fixture.invalid/browser';
const getSubscription = vi.fn();
const requestPermission = vi.fn().mockResolvedValue('granted');

function Probe() {
  const push = usePushNotifications();
  return <><output aria-label="Push status">{push.status}</output><button onClick={() => push.subscribe()}>Activar</button></>;
}

beforeEach(() => {
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription } }) } });
  getSubscription.mockResolvedValue({ toJSON: () => ({ endpoint, keys: { auth: 'fixture', p256dh: 'fixture' } }) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('registers an existing browser subscription before calling it active', async () => {
  const convex = makeTestConvexClient([], [stubMutation(api.notifications.subscribe, { ok: true })]);
  renderWithProviders(<Probe />, { convex });
  await waitFor(() => expect(screen.getByLabelText('Push status')).toHaveTextContent('subscribed'));
  expect(convex.calls).toContainEqual({ kind: 'mutation', name: 'notifications:subscribe', args: { endpoint, keys: { auth: 'fixture', p256dh: 'fixture' } } });
});

it('does not call a locally subscribed device active after Convex rejects it', async () => {
  const convex = makeTestConvexClient([], [stubMutationError(api.notifications.subscribe, new Error('fixture rejected'))]);
  renderWithProviders(<Probe />, { convex });
  await waitFor(() => expect(screen.getByLabelText('Push status')).toHaveTextContent('error'));
});

it('fails explicitly without a public key and does not request permission', async () => {
  getSubscription.mockResolvedValue(null);
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
  renderWithProviders(<Probe />);
  await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
  await waitFor(() => expect(screen.getByLabelText('Push status')).toHaveTextContent('error'));
  expect(requestPermission).not.toHaveBeenCalled();
});

function TestDelivery() {
  const test = useProbarAvisos();
  return <button onClick={() => test.mutate({})}>Enviar prueba</button>;
}

it('warns about the failed device without promising both devices received the push', async () => {
  const warning = vi.spyOn(toast, 'warning');
  const success = vi.spyOn(toast, 'success');
  const convex = makeTestConvexClient([], [{ name: 'notifications:probar', value: { dispositivos: 2, aceptados: 1, fallidos: 1, caducados: 0, push: true, pushConfigurado: true, correo: false, correoConfigurado: false } }]);
  renderWithProviders(<TestDelivery />, { convex });
  await userEvent.click(screen.getByRole('button', { name: 'Enviar prueba' }));
  await waitFor(() => expect(warning).toHaveBeenCalledWith(expect.stringContaining('1 de 2 envíos push aceptados; 1 fallaron')));
  expect(success).not.toHaveBeenCalled();
});

it('remakes a subscription created with another VAPID key and registers the new one', async () => {
  // A device subscribed before the keys changed receives nothing: the push
  // service answers 401 or 403. With permission already granted it heals
  // without asking, the next time the app opens.
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'AQID');
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const subscribe = vi.fn().mockResolvedValue({ toJSON: () => ({ endpoint: `${endpoint}/new`, keys: { auth: 'n', p256dh: 'n' } }) });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) } });
  getSubscription.mockResolvedValue({ endpoint, options: { applicationServerKey: new Uint8Array([9, 9, 9]).buffer }, unsubscribe, toJSON: () => ({ endpoint, keys: { auth: 'o', p256dh: 'o' } }) });
  const convex = makeTestConvexClient([], [stubMutation(api.notifications.subscribe, { ok: true }), stubMutation(api.notifications.unsubscribe, null)]);
  renderWithProviders(<Probe />, { convex });
  await waitFor(() => expect(screen.getByLabelText('Push status')).toHaveTextContent('subscribed'));
  expect(unsubscribe).toHaveBeenCalled();
  // The old row goes too: otherwise Ajustes counts a device that receives nothing.
  expect(convex.calls).toContainEqual({ kind: 'mutation', name: 'notifications:unsubscribe', args: { endpoint } });
  expect(convex.calls).toContainEqual({ kind: 'mutation', name: 'notifications:subscribe', args: { endpoint: `${endpoint}/new`, keys: { auth: 'n', p256dh: 'n' } } });
});

function Keeper() {
  useMantenerAvisos();
  return null;
}

it('keeps a granted device registered once per browser session and never asks for permission', async () => {
  sessionStorage.clear();
  const convex = makeTestConvexClient([], [stubMutation(api.notifications.subscribe, { ok: true })]);
  const first = renderWithProviders(<Keeper />, { convex });
  await waitFor(() => expect(convex.calls.filter((c) => c.name === 'notifications:subscribe')).toHaveLength(1));
  first.unmount();
  renderWithProviders(<Keeper />, { convex });
  await new Promise((r) => setTimeout(r, 20));
  expect(convex.calls.filter((c) => c.name === 'notifications:subscribe')).toHaveLength(1);
  expect(requestPermission).not.toHaveBeenCalled();
});

it('does nothing on a device that has not granted permission', async () => {
  sessionStorage.clear();
  vi.stubGlobal('Notification', { permission: 'default', requestPermission });
  const convex = makeTestConvexClient([], [stubMutation(api.notifications.subscribe, { ok: true })]);
  renderWithProviders(<Keeper />, { convex });
  await new Promise((r) => setTimeout(r, 20));
  expect(convex.calls).toEqual([]);
  expect(getSubscription).not.toHaveBeenCalled();
});
