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
import { useProbarAvisos, usePushNotifications } from './notifications.hooks';

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
