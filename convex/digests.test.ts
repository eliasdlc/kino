/**
 * El diario de sesiones: quién puede escribirlo, qué se le acota y qué pasa
 * cuando el hook reintenta. La línea del lunes cita una sesión real, así que lo
 * que se prueba aquí es sobre todo que no se pueda fabricar.
 */
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import { DIGEST_BYTES_MAX, DIGEST_QUOTE_MAX } from './digests';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };

const SECRETO = 'digest-hook-de-prueba';

const digestValido = (externalId = 'sesion-1') => ({
  source: 'claude-code',
  externalId,
  digest: { summary: 'Cerré el carril de migraciones', quote: 'esto no puede salir en el mismo deploy', quoteHash: 'abc', quoteOffset: 42 },
});

const subir = (t: ReturnType<typeof convexTest>, body: unknown, token = SECRETO) =>
  t.fetch('/digests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function conCuentas() {
  const t = convexTest(schema, modules);
  await t.withIdentity(ana).mutation(api.users.ensure, {});
  await t.withIdentity(beto).mutation(api.users.ensure, {});
  return t;
}

beforeEach(() => {
  process.env.KINO_DIGEST_TOKEN = SECRETO;
  process.env.KINO_DIGEST_EMAIL = ana.email;
});

afterEach(() => {
  delete process.env.KINO_DIGEST_TOKEN;
  delete process.env.KINO_DIGEST_EMAIL;
});

describe('la entrada del diario', () => {
  it('la credencial del hook deja una fila; cualquier otra clave no llega a mirar el cuerpo', async () => {
    const t = await conCuentas();

    const creada = await subir(t, digestValido());
    expect(creada.status).toBe(201);
    expect(await creada.json()).toMatchObject({ created: true });

    // Una clave personal cualquiera, con un cuerpo impecable.
    const ajena = await subir(t, digestValido('sesion-2'), 'sk-de-otro');
    expect(ajena.status).toBe(403);

    // Y sin credencial ninguna.
    const sinNada = await t.fetch('/digests', { method: 'POST', body: JSON.stringify(digestValido('sesion-3')) });
    expect(sinNada.status).toBe(403);

    const filas = await t.run((ctx) => ctx.db.query('sessionDigests').collect());
    expect(filas).toHaveLength(1);
  });

  it('el digest se guarda en el perfil que dice el deployment, no en el que diga el cuerpo', async () => {
    const t = await conCuentas();
    await subir(t, digestValido());

    const [fila] = await t.run((ctx) => ctx.db.query('sessionDigests').collect());
    const anaDoc = await t.run((ctx) => ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', ana.email)).unique());
    expect(fila.userId).toBe(anaDoc!._id);
    // Y la lectura está aislada: Beto no ve el diario de Ana.
    expect(await t.withIdentity(beto).query(api.digests.list, {})).toEqual([]);
    expect(await t.withIdentity(ana).query(api.digests.list, {})).toHaveLength(1);
  });

  it('una cita por encima del tope y un digest por encima de los bytes se rechazan sin dejar fila', async () => {
    const t = await conCuentas();

    const citaLarga = digestValido();
    citaLarga.digest.quote = 'x'.repeat(DIGEST_QUOTE_MAX + 1);
    expect((await subir(t, citaLarga)).status).toBe(400);

    const resumenEnorme = digestValido('sesion-2');
    resumenEnorme.digest.summary = 'y'.repeat(DIGEST_BYTES_MAX);
    expect((await subir(t, resumenEnorme)).status).toBe(400);

    expect(await t.run((ctx) => ctx.db.query('sessionDigests').collect())).toEqual([]);
  });

  it('dos envíos del mismo digest dejan una sola fila', async () => {
    const t = await conCuentas();

    expect((await subir(t, digestValido())).status).toBe(201);
    const reintento = await subir(t, { ...digestValido(), digest: { summary: 'Otro texto', quote: 'otra cita' } });
    expect(reintento.status).toBe(200);
    expect(await reintento.json()).toMatchObject({ created: false });

    const filas = await t.run((ctx) => ctx.db.query('sessionDigests').collect());
    expect(filas).toHaveLength(1);
    // El reintento no pisa lo guardado: la fila sigue siendo la primera.
    expect(filas[0].digest.summary).toBe('Cerré el carril de migraciones');
  });

  it('sin las dos variables del deployment la ruta no acepta nada', async () => {
    const t = await conCuentas();
    delete process.env.KINO_DIGEST_TOKEN;
    expect((await subir(t, digestValido())).status).toBe(503);
    expect(await t.run((ctx) => ctx.db.query('sessionDigests').collect())).toEqual([]);
  });

  it('ningún cron poda el diario: es rastro, no historia', async () => {
    const t = await conCuentas();
    await subir(t, digestValido());
    // Envejecida más de un año: si algún cron la podara, esta es la fila que
    // se llevaría por delante.
    await t.run(async (ctx) => {
      for (const fila of await ctx.db.query('sessionDigests').collect()) {
        await ctx.db.patch(fila._id, { createdAt: Date.now() - 400 * 86_400_000 });
      }
      return null;
    });

    await t.action(internal.scheduler.dailySnapshot, {});
    await t.mutation(internal.eventLog.podar, {});
    await t.finishAllScheduledFunctions(() => {});

    expect(await t.run((ctx) => ctx.db.query('sessionDigests').collect())).toHaveLength(1);
  });
});
