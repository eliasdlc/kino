/**
 * La entrada del resumen de WhatsApp: quién puede escribir, qué se rechaza y,
 * sobre todo, que un reintento no deje dos tareas ni resucite una que Elias
 * ya completó o borró.
 */
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };
const SECRETO = 'whatsapp-de-prueba';

const item = (overrides: Record<string, unknown> = {}) => ({
  externalId: 'wa:chat1:msg1',
  title: 'Mandar la cotización a Pedro',
  chatName: 'Pedro',
  ...overrides,
});

const subir = (t: ReturnType<typeof convexTest>, body: unknown, token: string | null = SECRETO) =>
  t.fetch('/whatsapp', {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const envio = (items: unknown[] = [item()]) => ({ source: 'whatsapp', items });

async function conCuentas({ bandeja = true } = {}) {
  const t = convexTest(schema, modules);
  await t.withIdentity(ana).mutation(api.users.ensure, {});
  await t.withIdentity(beto).mutation(api.users.ensure, {});
  if (bandeja) {
    await t.withIdentity(ana).mutation(api.systems.setup, {});
    await t.withIdentity(beto).mutation(api.systems.setup, {});
  }
  return t;
}

const tareasDe = (t: Awaited<ReturnType<typeof conCuentas>>, email: string) =>
  t.run(async (ctx) => {
    const user = await ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', email)).unique();
    return (await ctx.db.query('tasks').collect()).filter((task) => task.userId === user!._id);
  });

beforeEach(() => {
  process.env.KINO_WHATSAPP_TOKEN = SECRETO;
  process.env.KINO_WHATSAPP_EMAIL = ana.email;
});

afterEach(() => {
  delete process.env.KINO_WHATSAPP_TOKEN;
  delete process.env.KINO_WHATSAPP_EMAIL;
});

describe('la credencial de WhatsApp', () => {
  it('sin las dos variables la ruta responde 503 y no escribe nada', async () => {
    const t = await conCuentas();
    delete process.env.KINO_WHATSAPP_EMAIL;
    expect((await subir(t, envio())).status).toBe(503);

    process.env.KINO_WHATSAPP_EMAIL = ana.email;
    delete process.env.KINO_WHATSAPP_TOKEN;
    // Sin token configurado, mandar "Bearer undefined" tampoco abre la ruta.
    expect((await subir(t, envio(), 'undefined')).status).toBe(503);
    expect(await tareasDe(t, ana.email)).toHaveLength(0);
  });

  it('una clave distinta o ausente es 403 y no llega a mirar el cuerpo', async () => {
    const t = await conCuentas();
    expect((await subir(t, envio(), 'sk-de-otro')).status).toBe(403);
    expect((await subir(t, envio(), null)).status).toBe(403);
    // Cuerpo inválido con clave mala: gana el 403, no el 400.
    expect((await subir(t, { basura: true }, 'sk-de-otro')).status).toBe(403);
    expect(await tareasDe(t, ana.email)).toHaveLength(0);
  });

  it('la cuenta la fija el deployment: un cuerpo que nombra a otra no la cambia', async () => {
    const t = await conCuentas();
    const res = await subir(t, { ...envio(), email: beto.email, userId: 'x' });
    expect(res.status).toBe(200);
    expect(await tareasDe(t, ana.email)).toHaveLength(1);
    expect(await tareasDe(t, beto.email)).toHaveLength(0);
  });

  it('503 si la cuenta no tiene Bandeja, en vez de escribir en otro sitio', async () => {
    const t = await conCuentas({ bandeja: false });
    const res = await subir(t, envio());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'WHATSAPP_INBOX_NOT_FOUND' });
    expect(await tareasDe(t, ana.email)).toHaveLength(0);
  });
});

describe('la validación', () => {
  it.each([
    ['otra fuente', { source: 'pva', items: [item()] }],
    ['sin items', { source: 'whatsapp', items: [] }],
    ['más de 50 items', envio(Array.from({ length: 51 }, (_, i) => item({ externalId: `m${i}` })))],
    ['título vacío', envio([item({ title: '' })])],
    ['título de 201', envio([item({ title: 'x'.repeat(201) })])],
    ['externalId vacío', envio([item({ externalId: '' })])],
    ['descripción de 2001', envio([item({ description: 'x'.repeat(2_001) })])],
    ['chatName de 201', envio([item({ chatName: 'x'.repeat(201) })])],
    ['fecha en texto', envio([item({ dueDate: '2026-11-09' })])],
  ])('rechaza %s con 400', async (_, body) => {
    const t = await conCuentas();
    expect((await subir(t, body)).status).toBe(400);
    expect(await tareasDe(t, ana.email)).toHaveLength(0);
  });

  it('un cuerpo que no es JSON es 400', async () => {
    const t = await conCuentas();
    const res = await t.fetch('/whatsapp', { method: 'POST', headers: { Authorization: `Bearer ${SECRETO}` }, body: 'no json' });
    expect(res.status).toBe(400);
  });
});

describe('crear', () => {
  it('crea la tarea en la Bandeja y la devuelve como created', async () => {
    const t = await conCuentas();
    const res = await subir(t, envio([item({ description: 'Antes del lunes', dueDate: 1_800_000_000_000 })]));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: ['wa:chat1:msg1'], existing: [] });
    const [tarea] = await tareasDe(t, ana.email);
    const bandeja = await t.withIdentity(ana).query(api.systems.inbox, {});
    expect(tarea.systemId).toBe(bandeja!.id);
    expect(tarea).toMatchObject({
      title: 'Mandar la cotización a Pedro',
      description: 'Antes del lunes',
      dueDate: 1_800_000_000_000,
      status: 'backlog',
      externalSource: 'whatsapp',
      externalId: 'wa:chat1:msg1',
      createdVia: 'sync',
    });
  });
});

describe('idempotencia', () => {
  it('un reintento devuelve existing y no crea una segunda tarea', async () => {
    const t = await conCuentas();
    await subir(t, envio());

    const res = await subir(t, envio([item(), item({ externalId: 'wa:chat1:msg2', title: 'Otra' })]));
    expect(await res.json()).toEqual({ created: ['wa:chat1:msg2'], existing: ['wa:chat1:msg1'] });
    expect(await tareasDe(t, ana.email)).toHaveLength(2);
  });

  it('el mismo externalId dos veces en un envío crea una sola', async () => {
    const t = await conCuentas();
    const res = await subir(t, envio([item(), item({ title: 'Repetida' })]));
    expect(await res.json()).toEqual({ created: ['wa:chat1:msg1'], existing: ['wa:chat1:msg1'] });
    expect(await tareasDe(t, ana.email)).toHaveLength(1);
  });

  it('no pisa lo que Elias editó', async () => {
    const t = await conCuentas();
    await subir(t, envio());
    const [tarea] = await tareasDe(t, ana.email);
    await t.run((ctx) => ctx.db.patch(tarea._id, { title: 'Mi título' }));

    await subir(t, envio([item({ title: 'Título del archivo' })]));
    expect((await tareasDe(t, ana.email))[0].title).toBe('Mi título');
  });

  it('una tarea completada no se recrea ni se reabre', async () => {
    const t = await conCuentas();
    await subir(t, envio());
    const [tarea] = await tareasDe(t, ana.email);
    await t.run((ctx) => ctx.db.patch(tarea._id, { status: 'done' }));

    const res = await subir(t, envio());
    expect(await res.json()).toEqual({ created: [], existing: ['wa:chat1:msg1'] });
    const despues = await tareasDe(t, ana.email);
    expect(despues).toHaveLength(1);
    expect(despues[0].status).toBe('done');
  });

  it('una tarea borrada no se recrea', async () => {
    const t = await conCuentas();
    await subir(t, envio());
    const [tarea] = await tareasDe(t, ana.email);
    await t.run((ctx) => ctx.db.patch(tarea._id, { deletedAt: Date.now() }));

    const res = await subir(t, envio());
    expect(await res.json()).toEqual({ created: [], existing: ['wa:chat1:msg1'] });
    const despues = await tareasDe(t, ana.email);
    expect(despues).toHaveLength(1);
    expect(despues[0].deletedAt).toBeDefined();
  });

  it('la misma identidad de otra fuente o de otra cuenta no cuenta como existente', async () => {
    const t = await conCuentas();
    await t.run(async (ctx) => {
      const beto_ = await ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', beto.email)).unique();
      const sys = await ctx.db.query('systems').withIndex('by_user_inbox', (q) => q.eq('userId', beto_!._id).eq('isInbox', true)).first();
      await ctx.db.insert('tasks', {
        userId: beto_!._id, systemId: sys!._id, title: 'De Beto', status: 'backlog', energyLevel: 'medium', priority: 'medium',
        taskType: 'task', externalSource: 'whatsapp', externalId: 'wa:chat1:msg1', sortIndex: 0, inTodayPlan: false,
        notifiedBeforeDay: false, notifiedDueDay: false, reminderCount: 0, createdBy: beto_!._id,
        createdVia: 'sync', createdAt: 1, updatedAt: 1,
      });
    });
    const res = await subir(t, envio());
    expect(await res.json()).toEqual({ created: ['wa:chat1:msg1'], existing: [] });
  });
});
