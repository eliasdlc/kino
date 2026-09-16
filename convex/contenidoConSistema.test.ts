import component from '@convex-dev/migrations/test';
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { sistemaDeCarpeta, sistemaDeNota, sistemaDePagina, sistemaDeVersion } from './migrations/contenidoConSistema';
import schema from './schema';

// El expand del contract de contenido con sistema: cada documento huérfano
// recibe el sistema que le toca, de dónde le toca, y una segunda pasada no
// escribe nada. Lo que la migración decide (madre, carpeta, Bandeja) se prueba
// por la base, no por el nombre del campo.

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function conCuenta(t: ReturnType<typeof convexTest>) {
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  await asAna.mutation(api.systems.setup, {});
  const novela = await asAna.mutation(api.systems.create, { name: 'Novela', color: 'purple', templateType: 'writing', icon: 'book' });
  const bandeja = (await asAna.query(api.systems.inbox, {}))!.id as Id<'systems'>;
  return { asAna, userId, novela: novela.id as Id<'systems'>, bandeja };
}

const ahora = 1_000;
/** La autoría que todo documento lleva desde el contrato de autoría. */
const autoria = (userId: Id<'users'>) => ({ createdBy: userId, createdVia: 'session' as const });

describe('contenido con sistema: de dónde sale cada valor', () => {
  it('una carpeta huérfana hereda el sistema de su madre, y sin madre cae en la Bandeja', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, novela, bandeja } = await conCuenta(t);
    const madre = await asAna.mutation(api.folders.create, { systemId: novela, name: 'Parte 1' });

    const { hija, suelta } = await t.run(async (ctx) => {
      const base = { userId, name: 'x', color: 'blue' as const, sortIndex: 0, ...autoria(userId), createdAt: ahora, updatedAt: ahora };
      const hija = await ctx.db.insert('folders', { ...base, parentId: madre.id as Id<'folders'> });
      const suelta = await ctx.db.insert('folders', base);
      return {
        hija: (await ctx.db.get(hija))!,
        suelta: (await ctx.db.get(suelta))!,
      };
    });

    expect(await t.run((ctx) => sistemaDeCarpeta(ctx, hija))).toBe(novela);
    expect(await t.run((ctx) => sistemaDeCarpeta(ctx, suelta))).toBe(bandeja);
  });

  it('una página huérfana mira su carpeta, después su madre, y al final la Bandeja', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, novela, bandeja } = await conCuenta(t);
    const carpeta = await asAna.mutation(api.folders.create, { systemId: novela, name: 'Parte 1' });
    const madre = await asAna.mutation(api.pages.create, { systemId: novela, title: 'Capítulo 1' });

    const { enCarpeta, conMadre, suelta } = await t.run(async (ctx) => {
      const base = { userId, isPinned: false, ...autoria(userId), createdAt: ahora, updatedAt: ahora };
      const enCarpeta = await ctx.db.insert('pages', { ...base, folderId: carpeta.id as Id<'folders'> });
      const conMadre = await ctx.db.insert('pages', { ...base, parentPageId: madre.id as Id<'pages'> });
      const suelta = await ctx.db.insert('pages', base);
      return {
        enCarpeta: (await ctx.db.get(enCarpeta))!,
        conMadre: (await ctx.db.get(conMadre))!,
        suelta: (await ctx.db.get(suelta))!,
      };
    });

    expect(await t.run((ctx) => sistemaDePagina(ctx, enCarpeta))).toBe(novela);
    expect(await t.run((ctx) => sistemaDePagina(ctx, conMadre))).toBe(novela);
    expect(await t.run((ctx) => sistemaDePagina(ctx, suelta))).toBe(bandeja);
  });

  it('una nota y una versión heredan el sistema de la página donde viven', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, novela } = await conCuenta(t);
    const page = await asAna.mutation(api.pages.create, { systemId: novela, title: 'Capítulo 1' });
    const pageId = page.id as Id<'pages'>;

    const { nota, version } = await t.run(async (ctx) => {
      const nota = await ctx.db.insert('stickyNotes', {
        userId,
        pageId,
        color: 'blue',
        sortIndex: 0,
        isEureka: false,
        ...autoria(userId),
        createdAt: ahora,
        updatedAt: ahora,
      });
      const version = await ctx.db.insert('pageSnapshots', { pageId, userId, content: '<p>Antes.</p>', wordCount: 1, createdAt: ahora });
      return { nota: (await ctx.db.get(nota))!, version: (await ctx.db.get(version))! };
    });

    expect(await t.run((ctx) => sistemaDeNota(ctx, nota))).toBe(novela);
    expect(await t.run((ctx) => sistemaDeVersion(ctx, version))).toBe(novela);
  });

  it('una cuenta sin Bandeja deja sus huérfanos como están', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});
    const suelta = await t.run(async (ctx) => {
      const id = await ctx.db.insert('pages', { userId, isPinned: false, ...autoria(userId), createdAt: ahora, updatedAt: ahora });
      return (await ctx.db.get(id))!;
    });
    expect(await t.run(async (ctx) => (await sistemaDePagina(ctx, suelta)) ?? null)).toBeNull();
  });
});

describe('contenido con sistema: la corrida entera', () => {
  it('rellena las cuatro tablas en orden, deja cero pendientes y la segunda pasada no escribe', async () => {
    const t = convexTest(schema, modules);
    component.register(t);
    const { asAna, userId, novela, bandeja } = await conCuenta(t);
    const carpeta = await asAna.mutation(api.folders.create, { systemId: novela, name: 'Parte 1' });

    // Una página huérfana en una carpeta con sistema, con una nota y una
    // versión huérfanas colgando de ella, y una carpeta suelta. La nota y la
    // versión sólo pueden rellenarse si la página se rellenó antes.
    const ids = await t.run(async (ctx) => {
      const pagina = await ctx.db.insert('pages', { userId, folderId: carpeta.id as Id<'folders'>, isPinned: false, ...autoria(userId), createdAt: ahora, updatedAt: ahora });
      const nota = await ctx.db.insert('stickyNotes', { userId, pageId: pagina, color: 'blue', sortIndex: 0, isEureka: false, ...autoria(userId), createdAt: ahora, updatedAt: ahora });
      const version = await ctx.db.insert('pageSnapshots', { pageId: pagina, userId, content: '<p>Antes.</p>', wordCount: 1, createdAt: ahora });
      const suelta = await ctx.db.insert('folders', { userId, name: 'Suelta', color: 'blue', sortIndex: 0, ...autoria(userId), createdAt: ahora, updatedAt: ahora });
      return { pagina, nota, version, suelta };
    });

    expect(await t.query(internal.migrations.contenidoConSistema.pendientes, {})).toEqual({
      folders: 1,
      pages: 1,
      stickyNotes: 1,
      pageSnapshots: 1,
      total: 4,
    });

    await t.mutation(internal.migrations.contenidoConSistema.run, {});
    await t.finishAllScheduledFunctions(() => {});

    const despues = await t.run(async (ctx) => ({
      pagina: (await ctx.db.get(ids.pagina))!,
      nota: (await ctx.db.get(ids.nota))!,
      version: (await ctx.db.get(ids.version))!,
      suelta: (await ctx.db.get(ids.suelta))!,
    }));
    expect(despues.pagina.systemId).toBe(novela);
    expect(despues.nota.systemId).toBe(novela);
    expect(despues.version.systemId).toBe(novela);
    expect(despues.suelta.systemId).toBe(bandeja);
    expect((await t.query(internal.migrations.contenidoConSistema.pendientes, {})).total).toBe(0);

    // Segunda pasada: ningún `updatedAt` ni contenido cambia, porque no se
    // escribe ningún parche.
    await t.mutation(internal.migrations.contenidoConSistema.run, {});
    await t.finishAllScheduledFunctions(() => {});
    const otraVez = await t.run(async (ctx) => ({
      pagina: (await ctx.db.get(ids.pagina))!,
      suelta: (await ctx.db.get(ids.suelta))!,
    }));
    expect(otraVez.pagina).toEqual(despues.pagina);
    expect(otraVez.suelta).toEqual(despues.suelta);
  });
});
