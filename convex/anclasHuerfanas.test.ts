import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { limpiarPagina, quitarAnclas } from './migrations/anclasHuerfanas';
import schema from './schema';

// La limpieza de marcas que no sostienen ninguna nota. Lo que decide qué se va
// no es cómo se escribió la marca sino si hay una nota viva con ese id, así que
// la prueba pasa por la base y no sólo por el HTML.

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

const VIVA = 'ancla-viva';
const HUERFANA = 'ancla-huerfana';
const HUERFANA_MUTED = 'ancla-huerfana-muted';

const marca = (id: string, texto: string, muted = false) =>
  `<span data-anchor-id="${id}" class="sticky-anchor-mark"${muted ? ' data-anchor-muted=""' : ''}>${texto}</span>`;

const CON_TRES_MARCAS =
  `<p>Uno ${marca(VIVA, 'con su nota')}, dos ${marca(HUERFANA, 'sin ella')}` +
  ` y tres ${marca(HUERFANA_MUTED, 'sueltas', true)}.</p>`;

const SOLO_LA_VIVA = `<p>Uno ${marca(VIVA, 'con su nota')}, dos sin ella y tres sueltas.</p>`;

/**
 * Una página con las tres marcas y, si se pide, la nota viva que sostiene la
 * primera. Devuelve con qué correr la migración sobre esa página.
 */
async function conPagina(t: ReturnType<typeof convexTest>, opciones: { nota?: 'viva' | 'papelera' } = {}) {
  const asAna = t.withIdentity(ana);
  const system = await asAna.mutation(api.systems.create, {
    name: 'Universidad',
    color: 'blue',
    templateType: 'writing',
    icon: 'book',
  });
  const page = await asAna.mutation(api.pages.create, { systemId: system.id, title: 'Apuntes' });
  await asAna.mutation(api.pages.update, { id: page.id, content: CON_TRES_MARCAS });

  if (opciones.nota) {
    const nota = await asAna.mutation(api.stickyNotes.createOnPage, {
      pageId: page.id,
      content: 'Preguntar por esto',
      anchorId: VIVA,
    });
    if (opciones.nota === 'papelera') await asAna.mutation(api.stickyNotes.remove, { id: nota.id });
  }

  const pageId = page.id as Id<'pages'>;
  const leer = () => t.run(async (ctx) => (await ctx.db.get(pageId))!);
  return {
    pageId,
    leer,
    /** Corre la migración sobre la página y escribe su parche, como haría el componente. */
    migrar: async () => {
      const doc = await leer();
      const parche = await t.run((ctx) => limpiarPagina(ctx, doc));
      if (parche) await t.run((ctx) => ctx.db.patch(pageId, parche));
      return parche;
    },
  };
}

describe('la limpieza de anclas huérfanas', () => {
  it('deja la marca de la nota viva y se lleva las otras dos, con el texto intacto', async () => {
    const t = convexTest(schema, modules);
    const pagina = await conPagina(t, { nota: 'viva' });

    await pagina.migrar();

    const content = (await pagina.leer()).content;
    expect(content).toBe(SOLO_LA_VIVA);
    // El texto de las huérfanas se queda: lo que se fue es el span.
    expect(content).toContain('dos sin ella y tres sueltas');
  });

  it('correrla dos veces da el mismo resultado', async () => {
    const t = convexTest(schema, modules);
    const pagina = await conPagina(t, { nota: 'viva' });

    await pagina.migrar();
    const primera = (await pagina.leer()).content;
    const segundo = await pagina.migrar();

    // `t.run` convierte en `null` el «no hay parche» que devuelve la migración.
    expect(segundo).toBeNull();
    expect((await pagina.leer()).content).toBe(primera);
  });

  it('una nota en la papelera no sostiene su marca', async () => {
    const t = convexTest(schema, modules);
    const pagina = await conPagina(t, { nota: 'papelera' });

    await pagina.migrar();

    expect((await pagina.leer()).content).not.toContain('data-anchor-id');
  });

  it('sin ninguna nota no queda ninguna marca, y el párrafo sigue entero', async () => {
    const t = convexTest(schema, modules);
    const pagina = await conPagina(t);

    await pagina.migrar();

    const content = (await pagina.leer()).content;
    expect(content).toBe('<p>Uno con su nota, dos sin ella y tres sueltas.</p>');
  });

  it('no toca una página borrada: sus notas volverán con ella', async () => {
    const t = convexTest(schema, modules);
    const pagina = await conPagina(t);
    await t.run((ctx) => ctx.db.patch(pagina.pageId, { deletedAt: Date.now() }));

    const doc = (await pagina.leer()) as Doc<'pages'>;

    expect(await t.run((ctx) => limpiarPagina(ctx, doc))).toBeNull();
  });
});

describe('quitarAnclas', () => {
  it('conserva las marcas anidadas de una nota viva y se lleva la de fuera', () => {
    const html = `<p>${marca('fuera', `texto ${marca('dentro', 'anidado')}`)}</p>`;

    const { html: limpio, retiradas } = quitarAnclas(html, new Set(['dentro']));

    expect(retiradas).toBe(1);
    expect(limpio).toBe(`<p>texto ${marca('dentro', 'anidado')}</p>`);
  });

  it('no toca un span que no es un ancla', () => {
    const html = '<p><span class="codex-mention">Marta</span></p>';

    expect(quitarAnclas(html, new Set()).html).toBe(html);
  });
});
