import { afterEach, describe, expect, it, vi } from 'vitest';
import { enviarCorreo } from './correo';

/**
 * Qué se prueba: cómo se lee la respuesta de Resend. Sólo dos rechazos son de
 * una persona y para siempre: la dirección inválida y el destinatario que
 * onboarding@resend.dev no admite. Una clave mala, un dominio sin verificar, el
 * ritmo, el servidor, la red o un error que no se reconoce se reintentan. Los
 * mensajes son los que Resend dio el 17 de octubre de 2026 a la clave real.
 */

const correo = { asunto: 'a', texto: 't', html: '<p>t</p>' };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function conRespuesta(status: number | 'red', name?: string, message = 'x') {
  vi.stubEnv('RESEND_API_KEY', 're_prueba');
  vi.stubEnv('RESEND_FROM', 'Kino <onboarding@resend.dev>');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (status === 'red') throw new Error('sin red');
      return new Response(name ? JSON.stringify({ statusCode: status, name, message }) : 'no es json', { status });
    }),
  );
}

const enviar = () => enviarCorreo('ana@usekino.dev', correo);

describe('la respuesta de Resend', () => {
  it('2xx es enviado', async () => {
    conRespuesta(200);
    expect(await enviar()).toBe('enviado');
  });

  it('dirección inválida o destinatario que el remitente de pruebas no admite: rechazo', async () => {
    conRespuesta(422, 'validation_error', 'Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.');
    expect(await enviar()).toBe('rechazado');
    conRespuesta(403, 'validation_error', 'You can only send testing emails to your own email address (dueno@example.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.');
    expect(await enviar()).toBe('rechazado');
  });

  it('un dominio sin verificar es de toda la cuenta: se reintenta', async () => {
    conRespuesta(403, 'validation_error', 'The usekino.dev domain is not verified. Please, add and verify your domain on https://resend.com/domains');
    expect(await enviar()).toBe('fallo');
  });

  it('una clave mala, restringida o suspendida es de toda la cuenta: se reintenta', async () => {
    conRespuesta(400, 'validation_error', 'API key is invalid');
    expect(await enviar()).toBe('fallo');
    conRespuesta(401, 'validation_error', 'API key is invalid');
    expect(await enviar()).toBe('fallo');
    conRespuesta(401, 'missing_api_key');
    expect(await enviar()).toBe('fallo');
    conRespuesta(403, 'restricted_api_key');
    expect(await enviar()).toBe('fallo');
    conRespuesta(403, 'suspended_api_key');
    expect(await enviar()).toBe('fallo');
  });

  it('un 403 de validación con un mensaje que no se reconoce se reintenta', async () => {
    conRespuesta(403, 'validation_error', 'Algo que Resend dirá mañana');
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
