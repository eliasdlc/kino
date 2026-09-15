/**
 * Qué se prueba: que la fila de `users` puede nacer del webhook de Clerk sin
 * que nadie escriba en el camino de render, y que no puede nacer de otra cosa.
 *
 * La firma se calcula aquí con Web Crypto, no se finge: si la ruta dejara de
 * verificarla, el caso de la firma que no cuadra se pondría en verde y este
 * fichero sería el único sitio donde se nota.
 */
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');

const SECRETO = `whsec_${btoa('kino-webhook-de-prueba-0123456')}`;

const userCreated = (id = 'user_nuevo') => ({
  type: 'user.created',
  data: {
    id,
    email_addresses: [
      { id: 'idn_vieja', email_address: 'vieja@usekino.dev' },
      { id: 'idn_primaria', email_address: 'ana@usekino.dev' },
    ],
    primary_email_address_id: 'idn_primaria',
    first_name: 'Ana',
    last_name: 'De La Cruz',
    image_url: 'https://img.clerk.com/ana',
  },
});

const bytesDeBase64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
const base64DeBytes = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** La firma que Svix pone en `svix-signature`: HMAC-SHA256 de `id.timestamp.cuerpo`. */
async function firmar(id: string, timestamp: number, cuerpo: string, secreto = SECRETO): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw',
    bytesDeBase64(secreto.slice('whsec_'.length)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(`${id}.${timestamp}.${cuerpo}`));
  return `v1,${base64DeBytes(new Uint8Array(firma))}`;
}

async function entregar(t: ReturnType<typeof convexTest>, evento: unknown, opciones: { firmaDe?: string } = {}) {
  const cuerpo = JSON.stringify(evento);
  const id = 'msg_1';
  const timestamp = Math.floor(Date.now() / 1000);
  return t.fetch('/clerk/user-created', {
    method: 'POST',
    headers: {
      'svix-id': id,
      'svix-timestamp': String(timestamp),
      'svix-signature': await firmar(id, timestamp, cuerpo, opciones.firmaDe ?? SECRETO),
      'Content-Type': 'application/json',
    },
    body: cuerpo,
  });
}

const usuarios = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query('users').collect());

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRETO;
});

afterEach(() => {
  delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
});

describe('el webhook de cuenta nueva', () => {
  it('crea la fila con el correo primario y el nombre que Clerk conoce', async () => {
    const t = convexTest(schema, modules);

    expect((await entregar(t, userCreated())).status).toBe(200);

    const filas = await usuarios(t);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      clerkId: 'user_nuevo',
      email: 'ana@usekino.dev',
      name: 'Ana De La Cruz',
      image: 'https://img.clerk.com/ana',
      onboardingCompleted: false,
    });
  });

  it('el reintento del mismo evento no crea una segunda fila', async () => {
    const t = convexTest(schema, modules);

    await entregar(t, userCreated());
    expect((await entregar(t, userCreated())).status).toBe(200);

    expect(await usuarios(t)).toHaveLength(1);
  });

  it('una firma de otro secreto no crea nada', async () => {
    const t = convexTest(schema, modules);

    const respuesta = await entregar(t, userCreated(), { firmaDe: `whsec_${btoa('otro-secreto-cualquiera-12345')}` });

    expect(respuesta.status).toBe(400);
    expect(await usuarios(t)).toHaveLength(0);
  });

  it('sin el secreto en el deployment la ruta no acepta nada', async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const t = convexTest(schema, modules);

    expect((await entregar(t, userCreated())).status).toBe(503);
    expect(await usuarios(t)).toHaveLength(0);
  });

  it('un evento de otro tipo se reconoce y no crea nada, para que Clerk no lo reintente', async () => {
    const t = convexTest(schema, modules);

    const respuesta = await entregar(t, { type: 'session.created', data: { id: 'sess_1' } });

    expect(respuesta.status).toBe(200);
    expect(await usuarios(t)).toHaveLength(0);
  });

  it('una cuenta sin correo no se inventa uno', async () => {
    const t = convexTest(schema, modules);
    const sinCorreo = { ...userCreated(), data: { ...userCreated().data, email_addresses: [], primary_email_address_id: null } };

    expect((await entregar(t, sinCorreo)).status).toBe(200);
    expect(await usuarios(t)).toHaveLength(0);
  });
});
