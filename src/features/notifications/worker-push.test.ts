import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Qué se prueba: los botones que el service worker pinta en un push y lo que
 * manda al servidor cuando se pulsan. Es el único sitio donde viven, y antes
 * no los probaba nada: un aviso normal trae «Hecha» y «En 1 h», la pregunta de
 * una vencida trae «Sí, hecha» y «Todavía no», y cada botón manda su acción.
 */

type Handler = (event: Record<string, unknown>) => void;

function cargarWorker() {
  const handlers: Record<string, Handler> = {};
  const showNotification = vi.fn<(title: string, options: Record<string, unknown>) => Promise<undefined>>(async () => undefined);
  const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));
  const self = {
    addEventListener: (tipo: string, fn: Handler) => { handlers[tipo] = fn; },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => undefined) },
  };
  // El import del destino de compartir lo resuelve webpack; aquí no hace falta.
  const fuente = readFileSync(join(process.cwd(), 'worker/index.js'), 'utf8').replace(/^import .*$/m, '');
  new Function('self', 'fetch', 'atenderCompartido', 'guardarEnCola', 'leerDueno', fuente)(self, fetchMock, null, null, null);
  return { handlers, showNotification, fetchMock };
}

async function recibir(data: Record<string, unknown>) {
  const w = cargarWorker();
  let espera: Promise<unknown> = Promise.resolve();
  w.handlers.push!({ data: { json: () => data }, waitUntil: (p: Promise<unknown>) => { espera = p; } });
  await espera;
  return w;
}

const accion = { endpoint: 'https://kino.convex.site/push/accion', token: 'tok' };

describe('los botones del push', () => {
  it('un aviso de una tarea trae «Hecha» y «En 1 h»', async () => {
    const { showNotification } = await recibir({ title: 'Vence en 2 h', body: 'Pagar', accion });
    expect(showNotification.mock.calls[0]![1]).toMatchObject({
      actions: [{ action: 'hecha', title: 'Hecha' }, { action: 'posponer', title: 'En 1 h' }],
      requireInteraction: true,
    });
  });

  it('la pregunta de una vencida trae «Sí, hecha» y «Todavía no»', async () => {
    const { showNotification } = await recibir({ title: '¿Ya hiciste esto?', body: 'Pagar', accion, pregunta: true });
    expect(showNotification.mock.calls[0]![1]).toMatchObject({
      actions: [{ action: 'hecha', title: 'Sí, hecha' }, { action: 'manana', title: 'Todavía no' }],
    });
  });

  it('sin enlace firmado no hay botones, aunque sea una pregunta', async () => {
    const { showNotification } = await recibir({ title: 'x', body: 'y', pregunta: true });
    expect(showNotification.mock.calls[0]![1]).toMatchObject({ actions: [] });
  });

  it('«Todavía no» manda su acción con el enlace firmado y cierra el aviso', async () => {
    const { handlers, fetchMock } = cargarWorker();
    const close = vi.fn();
    let espera: Promise<unknown> = Promise.resolve();
    handlers.notificationclick!({
      action: 'manana',
      notification: { data: { url: '/tasks?tarea=1', accion }, close, tag: 'pregunta-1' },
      waitUntil: (p: Promise<unknown>) => { espera = p; },
    });
    await espera;
    expect(fetchMock).toHaveBeenCalledWith(accion.endpoint, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'tok', accion: 'manana' }),
    }));
    expect(close).toHaveBeenCalled();
  });
});
