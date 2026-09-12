import { convexTest } from 'convex-test';
import { ConvexError, type Value } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { MCP_TOKEN_ISSUER } from './lib/mcpToken';
import type { ActorChannel } from './schema';
import schema from './schema';

/**
 * La política de edición del agente se decide con la autoría original de la
 * página. Estas pruebas recorren las cuatro vías, el CAS, el rastro y el undo
 * sin pasar por el catálogo, porque la mutación es la frontera de seguridad.
 */

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function seed() {
  const t = convexTest(schema, modules);
  const navegador = t.withIdentity(ana);
  const userId = await navegador.mutation(api.users.ensure, {});
  const system = await navegador.mutation(api.systems.create, {
    name: 'Cuaderno',
    color: 'blue',
    templateType: 'writing',
    icon: 'book',
  });
  const agente = (clientId: string) =>
    t.withIdentity({ ...ana, issuer: MCP_TOKEN_ISSUER, kino_scope: 'write', kino_client: clientId });
  return { t, navegador, agente, userId, systemId: system.id };
}

async function insertarPagina(
  t: Awaited<ReturnType<typeof seed>>['t'],
  userId: Id<'users'>,
  systemId: Id<'systems'>,
  createdVia: ActorChannel,
) {
  return t.run((ctx) =>
    ctx.db.insert('pages', {
      userId,
      systemId,
      title: `Página ${createdVia}`,
      content: '<p>Original</p>',
      isPinned: false,
      lemas: 'pagina original',
      createdBy: userId,
      createdVia,
      createdAt: 1_000,
      updatedAt: 1_000,
    }),
  );
}

function errorData(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(ConvexError);
  return (error as ConvexError<Value>).data as unknown as Record<string, unknown>;
}

describe('política por autoría original', () => {
  it('una página creada por OAuth se edita directo desde otro cliente OAuth de la misma cuenta', async () => {
    const { t, agente, systemId } = await seed();
    const creadora = agente('claude_desktop');
    const otra = agente('t3_code');
    const page = await creadora.mutation(api.pages.create, {
      systemId,
      title: 'Del agente',
      content: '<p>Uno</p>',
    });

    const before = await otra.query(api.pages.byId, { id: page.id });
    expect(before).toMatchObject({ createdVia: 'oauth', agentEditPolicy: 'direct' });
    await otra.mutation(api.pages.updateFromAgent, {
      id: page.id,
      expectedUpdatedAt: before.updatedAt,
      content: '<p>Dos</p>',
    });

    const stored = await t.run((ctx) => ctx.db.get(page.id));
    expect(stored).toMatchObject({ content: '<p>Dos</p>', createdVia: 'oauth' });
  });

  it('una página de sesión no cambia sin confirmación y sí cambia con la declaración exacta', async () => {
    const { t, navegador, agente, systemId } = await seed();
    const page = await navegador.mutation(api.pages.create, {
      systemId,
      title: 'De Ana',
      content: '<p>Uno</p>',
    });
    const before = await navegador.query(api.pages.byId, { id: page.id });

    const error = await agente('claude_desktop')
      .mutation(api.pages.updateFromAgent, {
        id: page.id,
        expectedUpdatedAt: before.updatedAt,
        content: '<p>No autorizado</p>',
      })
      .catch((reason: unknown) => reason);
    expect(errorData(error)).toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      pageId: page.id,
      title: 'De Ana',
      createdVia: 'session',
      currentUpdatedAt: before.updatedAt,
    });
    expect(String(errorData(error).instruction)).toContain('Pregunta a la persona');
    expect((await t.run((ctx) => ctx.db.get(page.id)))!.content).toBe('<p>Uno</p>');

    await agente('claude_desktop').mutation(api.pages.updateFromAgent, {
      id: page.id,
      expectedUpdatedAt: before.updatedAt,
      content: '<p>Autorizado</p>',
      authorization: 'explicit_user_confirmation',
    });
    expect((await t.run((ctx) => ctx.db.get(page.id)))!.content).toBe('<p>Autorizado</p>');
  });

  it.each(['sync', 'system'] as const)('una página de origen %s exige confirmación', async (createdVia) => {
    const { t, agente, userId, systemId } = await seed();
    const id = await insertarPagina(t, userId, systemId, createdVia);

    const error = await agente('t3_code')
      .mutation(api.pages.updateFromAgent, {
        id,
        expectedUpdatedAt: new Date(1_000).toISOString(),
        title: 'Intento',
      })
      .catch((reason: unknown) => reason);

    expect(errorData(error)).toMatchObject({ code: 'CONFIRMATION_REQUIRED', createdVia });
    expect((await t.run((ctx) => ctx.db.get(id)))!.title).toBe(`Página ${createdVia}`);
  });

  it('una página antigua clasificada como session permanece protegida', async () => {
    const { t, agente, userId, systemId } = await seed();
    const id = await insertarPagina(t, userId, systemId, 'session');

    await expect(
      agente('t3_code').mutation(api.pages.updateFromAgent, {
        id,
        expectedUpdatedAt: new Date(1_000).toISOString(),
        title: 'Intento',
      }),
    ).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(id)))!.title).toBe('Página session');
  });

  it('una edición manual posterior no cambia el origen OAuth ni su política directa', async () => {
    const { t, navegador, agente, systemId } = await seed();
    const page = await agente('creador').mutation(api.pages.create, { systemId, title: 'Agente' });

    await navegador.mutation(api.pages.update, { id: page.id, title: 'Editada a mano' });
    const manual = await navegador.query(api.pages.byId, { id: page.id });
    expect(manual).toMatchObject({ createdVia: 'oauth', agentEditPolicy: 'direct' });

    await agente('otro').mutation(api.pages.updateFromAgent, {
      id: page.id,
      expectedUpdatedAt: manual.updatedAt,
      title: 'Editada otra vez por agente',
    });
    expect((await t.run((ctx) => ctx.db.get(page.id)))!.createdVia).toBe('oauth');
  });
});

describe('versión obligatoria y concurrencia', () => {
  it('rechaza desde MCP una actualización sin expectedUpdatedAt', async () => {
    const { t, agente, systemId } = await seed();
    const page = await agente('creador').mutation(api.pages.create, { systemId, title: 'Original' });

    await expect(
      agente('creador').mutation(api.pages.updateFromAgent, { id: page.id, title: 'Sin versión' } as never),
    ).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(page.id)))!.title).toBe('Original');
  });

  it('una versión desactualizada devuelve CONFLICT y no sobrescribe el contenido', async () => {
    const { t, navegador, agente, systemId } = await seed();
    const page = await agente('creador').mutation(api.pages.create, { systemId, title: 'Original', content: '<p>Uno</p>' });
    const stale = await navegador.query(api.pages.byId, { id: page.id });
    await t.run((ctx) => ctx.db.patch(page.id, { content: '<p>Cambió</p>', updatedAt: Date.parse(stale.updatedAt) + 1_000 }));

    const error = await agente('creador')
      .mutation(api.pages.updateFromAgent, {
        id: page.id,
        expectedUpdatedAt: stale.updatedAt,
        content: '<p>Pisado</p>',
      })
      .catch((reason: unknown) => reason);

    expect(errorData(error)).toMatchObject({ code: 'CONFLICT' });
    expect((await t.run((ctx) => ctx.db.get(page.id)))!.content).toBe('<p>Cambió</p>');
  });

  it('la mutación del editor conserva su contrato y no queda abierta a OAuth', async () => {
    const { t, navegador, agente, systemId } = await seed();
    const page = await navegador.mutation(api.pages.create, { systemId, title: 'Original' });

    await navegador.mutation(api.pages.update, { id: page.id, title: 'Desde el editor' });
    const stored = await t.run((ctx) => ctx.db.get(page.id));
    expect(stored).toMatchObject({
      title: 'Desde el editor',
      createdVia: 'session',
    });
    await expect(agente('cliente').mutation(api.pages.update, { id: page.id, title: 'Bypass' })).rejects.toThrow();
  });
});

describe('historial y deshacer', () => {
  it('conserva snapshot, event log y undo, y registra la base de autorización', async () => {
    const { t, navegador, agente, systemId } = await seed();
    const directa = await agente('creador').mutation(api.pages.create, {
      systemId,
      title: 'Directa',
      content: '<p>Antes directa</p>',
    });
    const protegida = await navegador.mutation(api.pages.create, {
      systemId,
      title: 'Protegida',
      content: '<p>Antes protegida</p>',
    });
    const directVersion = (await navegador.query(api.pages.byId, { id: directa.id })).updatedAt;
    const protectedVersion = (await navegador.query(api.pages.byId, { id: protegida.id })).updatedAt;

    await agente('otro').mutation(api.pages.updateFromAgent, {
      id: directa.id,
      expectedUpdatedAt: directVersion,
      title: 'Directa nueva',
      content: '<p>Después directa</p>',
    });
    await agente('otro').mutation(api.pages.updateFromAgent, {
      id: protegida.id,
      expectedUpdatedAt: protectedVersion,
      content: '<p>Después protegida</p>',
      authorization: 'explicit_user_confirmation',
    });

    const events = await t.run((ctx) => ctx.db.query('eventLog').collect());
    const directEvent = events.find((row) => row.action === 'page.update' && row.targetId === directa.id)!;
    const confirmedEvent = events.find((row) => row.action === 'page.update' && row.targetId === protegida.id)!;
    expect(directEvent.agentEditBasis).toBe('agent_origin');
    expect(confirmedEvent.agentEditBasis).toBe('explicit_user_confirmation');
    expect(directEvent.snapshotId).toEqual(expect.any(String));
    expect(directEvent.payload).toEqual({ title: 'Directa', contenidoCambiado: true });

    const snapshot = await t.run((ctx) => ctx.db.get(directEvent.snapshotId!));
    expect(snapshot!.content).toBe('<p>Antes directa</p>');
    expect(await navegador.mutation(api.eventLog.deshacer, { id: directEvent._id })).toEqual({ deshecho: true });
    const restored = await navegador.query(api.pages.byId, { id: directa.id });
    expect(restored).toMatchObject({ title: 'Directa', content: '<p>Antes directa</p>', createdVia: 'oauth' });
  });
});

describe('contrato de lectura', () => {
  it('get y list indican el origen y la política sin exponer createdBy', async () => {
    const { navegador, agente, systemId } = await seed();
    const oauthPage = await agente('creador').mutation(api.pages.create, { systemId, title: 'Agente' });
    const sessionPage = await navegador.mutation(api.pages.create, { systemId, title: 'Persona' });

    const direct = await agente('lector').query(api.pages.byId, { id: oauthPage.id });
    const protectedPage = await agente('lector').query(api.pages.byId, { id: sessionPage.id });
    const list = await agente('lector').query(api.pages.bySystem, { systemId });

    expect(direct).toMatchObject({ createdVia: 'oauth', agentEditPolicy: 'direct' });
    expect(protectedPage).toMatchObject({ createdVia: 'session', agentEditPolicy: 'confirmation_required' });
    expect(direct).not.toHaveProperty('createdBy');
    expect(list.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: oauthPage.id, createdVia: 'oauth', agentEditPolicy: 'direct' }),
        expect.objectContaining({ id: sessionPage.id, createdVia: 'session', agentEditPolicy: 'confirmation_required' }),
      ]),
    );
  });
});
