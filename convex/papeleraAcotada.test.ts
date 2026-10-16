/**
 * Qué se prueba: que enseñar la papelera de carpetas y de capítulos lee lo que
 * hay en ella y no la cuenta entera. Las dos son suscripciones vivas de Ajustes,
 * así que cada escritura que las toca las vuelve a leer: lo que leen se cuenta,
 * no se afirma. Y que lo que enseñan es lo mismo que antes, subárboles incluidos.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { deletedFolders } from './folders';
import { deletedPages } from './pages';
import schema from './schema';
import { espiar, type Cuenta } from '../src/shared/testing/espia';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

const VIVAS = 50;

/** Cincuenta carpetas y cincuenta capítulos vivos, y tres de cada en la papelera. */
async function sembrar() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run((ctx) =>
    ctx.db.insert('systems', {
      userId, createdBy: userId, createdVia: 'session', name: 'Novela', color: 'purple',
      templateType: 'writing', icon: 'book', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1,
    }),
  );

  const carpetas: string[] = [];
  const paginas: string[] = [];
  for (let i = 0; i < VIVAS + 3; i++) {
    carpetas.push((await asAna.mutation(api.folders.create, { systemId, name: `Parte ${i}` })).id);
    paginas.push((await asAna.mutation(api.pages.create, { systemId, title: `Capítulo ${i}` })).id);
  }
  // Una subcarpeta y un subcapítulo que se van con su madre: la papelera los
  // enseña dentro de ella, no sueltos.
  const subcarpeta = await asAna.mutation(api.folders.create, { systemId, name: 'Escenas', parentId: carpetas[0] as Id<'folders'> });
  const subpagina = await asAna.mutation(api.pages.create, { systemId, parentPageId: paginas[0] as Id<'pages'>, title: 'Escena' });
  for (let i = 0; i < 3; i++) {
    await asAna.mutation(api.folders.remove, { id: carpetas[i] as Id<'folders'> });
    await asAna.mutation(api.pages.remove, { id: paginas[i] as Id<'pages'> });
  }
  return { t, asAna, userId, carpetas, paginas, subcarpeta, subpagina };
}

describe('la papelera lee lo que hay en ella', { timeout: 60_000 }, () => {
  it('las carpetas borradas se leen sin pasar por las cincuenta vivas', async () => {
    const { t, userId } = await sembrar();
    const cuenta: Cuenta = { consultas: 0, documentos: 0 };

    const borradas = await t.run((ctx) => deletedFolders({ ...ctx, db: espiar(ctx.db, cuenta) }, userId));

    // Tres carpetas y la subcarpeta que se fue con la primera.
    expect(borradas).toHaveLength(4);
    expect(cuenta).toEqual({ consultas: 1, documentos: 4 });
  });

  it('los capítulos borrados se leen sin pasar por los cincuenta vivos', async () => {
    const { t, userId } = await sembrar();
    const cuenta: Cuenta = { consultas: 0, documentos: 0 };

    const borradas = await t.run((ctx) => deletedPages({ ...ctx, db: espiar(ctx.db, cuenta) }, userId));

    expect(borradas).toHaveLength(4);
    expect(cuenta).toEqual({ consultas: 1, documentos: 4 });
  });

  it('la papelera enseña lo mismo: las tres raíces, cada una con lo que se fue con ella', async () => {
    const { asAna, carpetas, paginas } = await sembrar();

    const enCarpetas = await asAna.query(api.folders.trashed, {});
    const enPaginas = await asAna.query(api.pages.trashed, {});

    expect(enCarpetas.map((c) => [c.id, c.subfolderCount]).sort()).toEqual(
      [[carpetas[0], 1], [carpetas[1], 0], [carpetas[2], 0]].sort(),
    );
    expect(enPaginas.map((p) => [p.id, p.subpageCount]).sort()).toEqual(
      [[paginas[0], 1], [paginas[1], 0], [paginas[2], 0]].sort(),
    );
  });

  it('restaurar sigue devolviendo la carpeta con su subárbol', async () => {
    const { t, asAna, carpetas, subcarpeta } = await sembrar();

    await asAna.mutation(api.folders.restore, { id: carpetas[0] as Id<'folders'> });

    const sub = await t.run((ctx) => ctx.db.get(subcarpeta.id as Id<'folders'>));
    expect(sub!.deletedAt).toBeUndefined();
    expect((await asAna.query(api.folders.trashed, {})).map((c) => c.id).sort()).toEqual([carpetas[1], carpetas[2]].sort());
  });
});
