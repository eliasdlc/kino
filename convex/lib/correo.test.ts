import { afterEach, describe, expect, it, vi } from 'vitest';
import { enviarCorreo } from './correo';

/**
 * Qué se prueba: cómo se lee la respuesta de Resend. Sólo un `validation_error`
 * que no es de autenticación es un rechazo para siempre (dominio sin verificar,
 * destinatario que onboarding@resend.dev no admite, dirección inválida) y no se
 * reintenta. Una clave mala, el ritmo, el servidor o la red se reintentan. Las
 * respuestas son las que Resend dio el 17 de octubre de 2026 a la clave real.
 */

const correo = { asunto: 'a', texto: 't', html: '<p>t</p>' };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function conRespuesta(status: number | 'red', name?: string) {
  vi.stubEnv('RESEND_API_KEY', 're_prueba');
  vi.stubEnv('RESEND_FROM', 'Kino <onboarding@resend.dev>');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (status === 'red') throw new Error('sin red');
      return new Response(name ? JSON.stringify({ statusCode: status, name, message: 'x' }) : 'no es json', { status });
    }),
  );
}

const enviar = () => enviarCorreo('ana@usekino.dev', correo);

describe('la respuesta de Resend', () => {
  it('2xx es enviado', async () => {
    conRespuesta(200);
    expect(await enviar()).toBe('enviado');
  });

  it('dominio sin verificar, destinatario no admitido o dirección inválida: rechazo', async () => {
    conRespuesta(403, 'validation_error');
    expect(await enviar()).toBe('rechazado');
    conRespuesta(422, 'validation_error');
    expect(await enviar()).toBe('rechazado');
  });

  it('una clave inválida o restringida es de toda la cuenta: se reintenta', async () => {
    conRespuesta(401, 'validation_error');
    expect(await enviar()).toBe('fallo');
    conRespuesta(401, 'missing_api_key');
    expect(await enviar()).toBe('fallo');
    conRespuesta(403, 'restricted_api_key');
    expect(await enviar()).toBe('fallo');
  });

  it('ritmo, servidor, red o un cuerpo que no se entiende: se reintenta', async () => {
    for (const [status, name] of [[429, 'rate_limit_exceeded'], [500, 'internal_server_error'], [503, undefined], [403, undefined], ['red', undefined]] as const) {
      conRespuesta(status, name);
      expect(await enviar()).toBe('fallo');
    }
  });

  it('sin clave o sin remitente no se llama a Resend', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await enviar()).toBe('fallo');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
