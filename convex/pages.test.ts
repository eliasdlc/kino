import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import { PAGE_CONTENT_MAX, PAGE_LIST_LIMIT } from './pages';
import schema from './schema';

// La lista de páginas de un sistema. Lo que se prueba aquí es el tope: sin él,
// cada página añade dos consultas más (sus etiquetas y sus subpáginas) a la
// misma invocación, y un sistema de escritura grande convierte una lectura en
// varios cientos de operaciones.

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run((ctx) =>
    ctx.db.insert('systems', {
      userId, createdBy: userId, createdVia: 'session', name: 'Obra', color: 'blue',
      templateType: 'writing', icon: 'x', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1,
    }),
  );
  return { t, asAna, userId, systemId };
}

/** Inserta directas: `pages.create` recalcula menciones y sesión de escritura. */
async function insertarPaginas(t: Awaited<ReturnType<typeof seed>>['t'], userId: string, systemId: string, cuantas: number) {
  await t.run(async (ctx) => {
    for (let i = 0; i < cuantas; i++) {
      await ctx.db.insert('pages', {
        userId: userId as never,
        systemId: systemId as never,
        title: `Capítulo ${i}`,
        content: `<p>${'palabra '.repeat(50)}</p>`,
        isPinned: false,
        lemas: 'capitulo palabra',
        createdBy: userId as never,
        createdVia: 'session',
        createdAt: 1 + i,
        updatedAt: 1 + i,
      });
    }
  });
}

describe('pages.bySystem', () => {
  it('por debajo del tope devuelve todas y no deja nada fuera', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await insertarPaginas(t, userId, systemId, 5);

    const { items, restantes } = await asAna.query(api.pages.bySystem, { systemId });

    expect(items).toHaveLength(5);
    expect(restantes).toBe(0);
  });

  it('ningún elemento de la lista lleva el contenido, sólo su vista previa', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await insertarPaginas(t, userId, systemId, 3);

    const { items } = await asAna.query(api.pages.bySystem, { systemId });

    for (const item of items) {
      expect(item).not.toHaveProperty('content');
      expect(item.contentPreview!.length).toBeLessThanOrEqual(300);
      expect(item.wordCount).toBe(50);
    }
  });

  it('por encima del tope corta y dice cuántas quedaron fuera', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await insertarPaginas(t, userId, systemId, PAGE_LIST_LIMIT + 3);

    const { items, restantes } = await asAna.query(api.pages.bySystem, { systemId });

    expect(items).toHaveLength(PAGE_LIST_LIMIT);
    expect(restantes).toBe(3);
  });
});

describe('el tope del contenido', () => {
  it('un capítulo largo de verdad entra sin problema', async () => {
    const { asAna, systemId } = await seed();
    // Quince mil palabras con su HTML: el capítulo más largo que nadie escribe.
    const capitulo = `<p>${'palabra '.repeat(15_000)}</p>`;
    expect(capitulo.length).toBeLessThan(PAGE_CONTENT_MAX);

    const pagina = await asAna.mutation(api.pages.create, { systemId, title: 'Capítulo 1', content: capitulo });

    expect((await asAna.query(api.pages.byId, { id: pagina.id })).content).toHaveLength(capitulo.length);
  });

  it('pasarse del tope se rechaza al escribir, con el límite en el mensaje', async () => {
    const { asAna, systemId } = await seed();

    await expect(
      asAna.mutation(api.pages.create, { systemId, title: 'Demasiado', content: 'x'.repeat(PAGE_CONTENT_MAX + 1) }),
    ).rejects.toThrow(String(PAGE_CONTENT_MAX.toLocaleString('es')));
  });

  it('lo guardado por encima del tope se sigue leyendo: el tope es de escritura', async () => {
    const { asAna, t, userId, systemId } = await seed();
    const enorme = 'y'.repeat(PAGE_CONTENT_MAX + 100);

    const id = await t.run((ctx) =>
      ctx.db.insert('pages', {
        userId: userId as never, systemId: systemId as never, createdBy: userId as never, createdVia: 'session',
        title: 'Vieja', content: enorme, isPinned: false, lemas: 'vieja', createdAt: 1, updatedAt: 1,
      }),
    );

    expect((await asAna.query(api.pages.byId, { id })).content).toHaveLength(enorme.length);
  });
});
