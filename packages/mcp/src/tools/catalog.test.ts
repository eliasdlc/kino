import { describe, expect, it } from 'vitest';
import { CATALOG, type ToolSpec } from './catalog.js';

/**
 * Lo que el agente recibe de una página. La tool decía "markdown" desde el
 * principio y devolvía el HTML guardado; esto fija que ya no.
 *
 * Se prueba sobre el catálogo y no sobre la función suelta a propósito: lo que
 * puede romperse es que alguien edite la entrada y le quite el `mapResult`.
 */

const spec = (id: 'pages.byId' | 'pages.update') => CATALOG[id] as ToolSpec;

const page = {
  id: '3f1b0f4e-6a3f-4f5e-9a2f-2c0f0b6d1a11',
  title: 'Sesión',
  updatedAt: '2026-08-28T04:02:02.000Z',
};

describe('el catálogo de páginas', () => {
  it('devuelve el contenido en markdown y lo dice', () => {
    expect(spec('pages.byId').mapResult!({ ...page, content: '<h2>Hola</h2>' })).toEqual({
      ...page,
      content: '## Hola',
      contentFormat: 'markdown',
    });
  });

  it('conserva updatedAt, que es la versión que update_page pide de vuelta', () => {
    const mapped = spec('pages.byId').mapResult!({ ...page, content: '<p>x</p>' }) as {
      updatedAt: string;
    };

    expect(mapped.updatedAt).toBe(page.updatedAt);
  });

  it('una página en blanco sigue en blanco', () => {
    expect(spec('pages.byId').mapResult!({ ...page, content: null })).toMatchObject({
      content: null,
    });
  });

  it('lo que no es una página pasa de largo', () => {
    const sinContenido = { ok: true };

    expect(spec('pages.byId').mapResult!(sinContenido)).toBe(sinContenido);
  });

  it('update_page convierte a HTML al escribir y vuelve a markdown al contestar', () => {
    const update = spec('pages.update');

    expect(update.prepareInput!({ id: page.id, content: '## Hola' }).content).toBe(
      '<h2>Hola</h2>\n',
    );
    expect(update.mapResult!({ ...page, content: '<h2>Hola</h2>' })).toMatchObject({
      content: '## Hola',
    });
  });
});
