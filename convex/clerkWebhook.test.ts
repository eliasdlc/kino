/**
 * Qué se prueba: que la fila de `users` puede nacer del webhook de Clerk sin
 * que nadie escriba en el camino de render, y que no puede nacer de otra cosa.
 * Y lo simétrico: que una cuenta borrada en Clerk se lleva sus datos de Convex,
 * y que nada que no venga firmado por Clerk puede borrarlos.
 *
 * La firma se calcula aquí con Web Crypto, no se finge: si la ruta dejara de
 * verificarla, el caso de la firma que no cuadra se pondría en verde y este
 * fichero sería el único sitio donde se nota.
 */
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
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

/** Lo que Clerk manda al borrar: sólo el id, sin correo ni nombre. */
const userDeleted = (id = 'user_nuevo') => ({ type: 'user.deleted', data: { id, object: 'user', deleted: true } });

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

describe('el webhook de cuenta borrada', () => {
  /** Ana nace por el webhook, abre un sistema y escribe una tarea; Bob existe al lado. */
  async function conDatos(t: ReturnType<typeof convexTest>) {
    await entregar(t, userCreated('user_ana'));
    const asAna = t.withIdentity({ subject: 'user_ana', email: 'ana@usekino.dev' });
    const sistema = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
    await asAna.mutation(api.tasks.create, { systemId: sistema.id, title: 'De Ana' });
    const asBob = t.withIdentity({ subject: 'user_bob', email: 'bob@usekino.dev' });
    const bobId = await asBob.mutation(api.users.ensure, {});
    await asBob.mutation(api.systems.create, { name: 'Suyo', color: 'blue', templateType: 'project', icon: 'rocket' });
    return { bobId };
  }

  const restos = (t: ReturnType<typeof convexTest>) =>
    t.run(async (ctx) => ({
      users: await ctx.db.query('users').collect(),
      systems: await ctx.db.query('systems').collect(),
      tasks: await ctx.db.query('tasks').collect(),
    }));

  it('se lleva la fila y los datos de esa cuenta, y no toca los de otra', async () => {
    const t = convexTest(schema, modules);
    const { bobId } = await conDatos(t);

    expect((await entregar(t, userDeleted('user_ana'))).status).toBe(200);

    const quedan = await restos(t);
    expect(quedan.users.map((u) => u._id)).toEqual([bobId]);
    expect(quedan.systems.every((s) => s.userId === bobId)).toBe(true);
    expect(quedan.systems).toHaveLength(1);
    expect(quedan.tasks).toHaveLength(0);
  });

  it('una firma de otro secreto no borra nada', async () => {
    const t = convexTest(schema, modules);
    await conDatos(t);
    const antes = await restos(t);

    const respuesta = await entregar(t, userDeleted('user_ana'), { firmaDe: `whsec_${btoa('otro-secreto-cualquiera-12345')}` });

    expect(respuesta.status).toBe(400);
    expect(await restos(t)).toEqual(antes);
  });

  it('sin el secreto en el deployment no borra nada', async () => {
    const t = convexTest(schema, modules);
    await conDatos(t);
    const antes = await restos(t);
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    expect((await entregar(t, userDeleted('user_ana'))).status).toBe(503);
    expect(await restos(t)).toEqual(antes);
  });

  it('una cuenta que Kino no conoce responde 200, para que Clerk no lo reintente', async () => {
    const t = convexTest(schema, modules);
    const { bobId } = await conDatos(t);

    const respuesta = await entregar(t, userDeleted('user_desconocido'));

    expect(respuesta.status).toBe(200);
    expect((await restos(t)).users).toHaveLength(2);
    expect((await restos(t)).users.map((u) => u._id)).toContain(bobId);
  });

  it('cuando la cuenta ya se purgó desde Kino, el aviso de Clerk que llega después responde 200', async () => {
    const t = convexTest(schema, modules);
    await conDatos(t);
    const ana = await t.run((ctx) => ctx.db.query('users').withIndex('by_clerkId', (q) => q.eq('clerkId', 'user_ana')).unique());
    await t.mutation(internal.users.purge, { userId: ana!._id });

    expect((await entregar(t, userDeleted('user_ana'))).status).toBe(200);
    expect((await entregar(t, userDeleted('user_ana'))).status).toBe(200);
  });

  it('purgar una cuenta que ya no está no falla, para que los dos borrados puedan cruzarse', async () => {
    const t = convexTest(schema, modules);
    await conDatos(t);
    const ana = await t.run((ctx) => ctx.db.query('users').withIndex('by_clerkId', (q) => q.eq('clerkId', 'user_ana')).unique());

    await t.mutation(internal.users.purge, { userId: ana!._id });
    await expect(t.mutation(internal.users.purge, { userId: ana!._id })).resolves.toBeNull();
  });
});
