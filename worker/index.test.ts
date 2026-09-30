import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

function worker(status: number, action = 'hecha') {
  const handlers = new Map<string, (event: unknown) => void>();
  const close = vi.fn();
  const openWindow = vi.fn().mockResolvedValue(null);
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const source = readFileSync(new URL('./index.js', import.meta.url), 'utf8').replace(/^import .*;$/m, '');
  runInNewContext(source, {
    self: { addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler), clients: { openWindow }, registration: { showNotification } },
    fetch: vi.fn().mockResolvedValue({ ok: status === 204, status }),
    AbortController, setTimeout, clearTimeout, URL, Response, crypto,
  });
  let pending: Promise<unknown> = Promise.resolve();
  handlers.get('notificationclick')!({ action, notification: { close, tag: 'fixture', data: { url: '/tasks?tarea=fixture', accion: { endpoint: 'https://fixture.invalid', token: 'fixture' } } }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
  return { pending, close, openWindow, showNotification };
}

it.each([403, 503])('shows the failed action and opens the task on HTTP %s', async status => {
  const w = worker(status);
  await w.pending;
  expect(w.showNotification).toHaveBeenCalledWith('No se pudo completar la tarea', expect.objectContaining({ data: { url: '/tasks?tarea=fixture' } }));
  expect(w.openWindow).toHaveBeenCalledWith('/tasks?tarea=fixture');
  expect(w.close).not.toHaveBeenCalled();
});

it('closes the original notification only after the action succeeds', async () => {
  const w = worker(204);
  await w.pending;
  expect(w.close).toHaveBeenCalledOnce();
  expect(w.showNotification).not.toHaveBeenCalled();
  expect(w.openWindow).not.toHaveBeenCalled();
});

it('shows the failed postponement instead of dismissing it on HTTP 503', async () => {
  const w = worker(503, 'posponer');
  await w.pending;
  expect(w.showNotification).toHaveBeenCalledWith('No se pudo posponer el aviso', expect.objectContaining({ data: { url: '/tasks?tarea=fixture' } }));
  expect(w.openWindow).toHaveBeenCalledWith('/tasks?tarea=fixture');
  expect(w.close).not.toHaveBeenCalled();
});
