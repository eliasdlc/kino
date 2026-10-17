import { afterEach, describe, expect, it, vi } from 'vitest';
import { enviarCorreo } from './correo';

/**
 * Qué se prueba: cómo se lee la respuesta de Resend. Un 4xx que no es de ritmo
 * es un rechazo para siempre (dominio sin verificar, dirección inválida) y no
 * se reintenta; un 429, un 5xx o la red caída son pasajeros. Antes todo era
 * `false` y todo se reintentaba cada quince minutos.
 */

const correo = { asunto: 'a', texto: 't', html: '<p>t</p>' };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function conRespuesta(status: number | 'red') {
  vi.stubEnv('RESEND_API_KEY', 're_prueba');
  vi.stubEnv('RESEND_FROM', 'Kino <onboarding@resend.dev>');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (status === 'red') throw new Error('sin red');
      return new Response('{}', { status });
    }),
  );
}

describe('la respuesta de Resend', () => {
  it('2xx es enviado', async () => {
    conRespuesta(200);
    expect(await enviarCorreo('ana@usekino.dev', correo)).toBe('enviado');
  });

  it('403 por dominio sin verificar y 422 por dirección inválida son rechazos', async () => {
    conRespuesta(403);
    expect(await enviarCorreo('ana@usekino.dev', correo)).toBe('rechazado');
    conRespuesta(422);
    expect(await enviarCorreo('ana@usekino.dev', correo)).toBe('rechazado');
  });

  it('429, 5xx y la red caída son pasajeros', async () => {
    for (const status of [429, 500, 503, 'red'] as const) {
      conRespuesta(status);
      expect(await enviarCorreo('ana@usekino.dev', correo)).toBe('fallo');
    }
  });

  it('sin clave o sin remitente no se llama a Resend', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await enviarCorreo('ana@usekino.dev', correo)).toBe('fallo');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
