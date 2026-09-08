/**
 * Qué se prueba: que ninguna lectura pública de carpetas, notas adhesivas y
 * capítulos devuelve algo que está en la papelera, y que restaurar devuelve la
 * cosa entera con lo que se fue con ella.
 *
 * El recorrido sale de los exports de cada módulo, no de una lista escrita a
 * mano: una lectura nueva que se olvide el filtro de `deletedAt` rompe este
 * test el día que se escribe, que es justo el defecto que no rompe ningún otro.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import type { FunctionReference } from 'convex/server';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };

/** Una función registrada por Convex lleva las marcas que le pone el registrador. */
type Registrada = { isQuery?: boolean; isPublic?: boolean };

/** Los nombres de las lecturas públicas de un módulo de `convex/`. */
async function lecturasDe(nombre: string): Promise<string[]> {
  const modulo = (await modules[`./${nombre}.ts`]!()) as Record<string, unknown>;
  return Object.entries(modulo)
    .filter(([, valor]) => typeof valor === 'function' && (valor as Registrada).isPublic === true && (valor as Registrada).isQuery === true)
    .map(([nombre]) => nombre);
}

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

  // Una carpeta con tres subcarpetas, dos de ellas anidadas.
  const raiz = await asAna.mutation(api.folders.create, { systemId, name: 'Parte 1' });
  const hija = await asAna.mutation(api.folders.create, { systemId, name: 'Capítulos', parentId: raiz.id });
  const nieta = await asAna.mutation(api.folders.create, { systemId, name: 'Escenas', parentId: hija.id });
  const otraHija = await asAna.mutation(api.folders.create, { systemId, name: 'Notas de la parte', parentId: raiz.id });

  const pagina = await asAna.mutation(api.pages.create, { systemId, folderId: raiz.id, title: 'La daga', content: '<p>La daga de obsidiana</p>' });
  const subpagina = await asAna.mutation(api.pages.create, { systemId, parentPageId: pagina.id, title: 'La daga, escena dos' });
  const notaDePagina = await asAna.mutation(api.stickyNotes.createOnPage, { pageId: pagina.id, content: 'Revisar el filo' });
  const notaDeCarpeta = await asAna.mutation(api.stickyNotes.createOnFolder, { folderId: raiz.id, content: 'Falta el mapa' });

  return { t, asAna, userId, systemId, raiz, hija, nieta, otraHija, pagina, subpagina, notaDePagina, notaDeCarpeta };
}

type Sembrado = Awaited<ReturnType<typeof sembrar>>;

/**
 * Con qué argumentos se llama cada lectura para que devuelva algo. Un módulo
 * que gane una lectura y no entre aquí falla el test de cobertura de abajo: el
 * recorrido no puede quedarse corto sin que alguien se entere.
 */
const ARGUMENTOS: Record<string, (s: Sembrado) => Record<string, unknown>> = {
  'folders:tree': () => ({}),
  'folders:bySystem': (s) => ({ systemId: s.systemId }),
  'folders:children': (s) => ({ id: s.raiz.id }),
  'folders:detail': (s) => ({ id: s.raiz.id }),
  'folders:trashed': () => ({}),
  'stickyNotes:byPage': (s) => ({ pageId: s.pagina.id }),
  'stickyNotes:byFolder': (s) => ({ folderId: s.raiz.id }),
  'stickyNotes:trashed': () => ({}),
  'pages:bySystem': (s) => ({ systemId: s.systemId }),
  'pages:forExport': (s) => ({ systemId: s.systemId }),
  'pages:subpages': (s) => ({ id: s.pagina.id }),
  'pages:byId': (s) => ({ id: s.pagina.id }),
  'pages:linkedTasks': (s) => ({ id: s.pagina.id }),
  'pages:tags': (s) => ({ id: s.pagina.id }),
  'pages:search': () => ({ query: 'daga' }),
  'pages:trashed': () => ({}),
};

/** Las únicas lecturas que sí devuelven lo borrado: la papelera es su trabajo. */
const LA_PAPELERA = new Set(['folders:trashed', 'stickyNotes:trashed', 'pages:trashed']);

/**
 * Llama la lectura y devuelve su resultado en crudo. Una que se niega a
 * responder sobre un documento borrado (`NOT_FOUND`) ya está filtrando, así
 * que cuenta como limpia.
 */
async function leer(s: Sembrado, modulo: string, nombre: string): Promise<string> {
  const fn = (api as unknown as Record<string, Record<string, FunctionReference<'query'>>>)[modulo]![nombre]!;
  try {
    return JSON.stringify(await s.asAna.query(fn, ARGUMENTOS[`${modulo}:${nombre}`]!(s)));
  } catch {
    return '';
  }
}

describe('el recorrido de las lecturas', () => {
  it('cada lectura pública de los tres módulos está en la tabla de argumentos', async () => {
    const faltan: string[] = [];
    for (const modulo of ['folders', 'stickyNotes', 'pages']) {
      for (const nombre of await lecturasDe(modulo)) {
        if (!(`${modulo}:${nombre}` in ARGUMENTOS)) faltan.push(`${modulo}:${nombre}`);
      }
    }
    expect(faltan).toEqual([]);
  });

  it('borrar una carpeta la saca de todas ellas, con su subárbol y sus notas', async () => {
    const s = await sembrar();
    const borrados = [s.raiz.id, s.hija.id, s.nieta.id, s.otraHija.id, s.notaDeCarpeta.id];

    await s.asAna.mutation(api.folders.remove, { id: s.raiz.id });

    for (const modulo of ['folders', 'stickyNotes', 'pages']) {
      for (const nombre of await lecturasDe(modulo)) {
        const salida = await leer(s, modulo, nombre);
        const encontrados = borrados.filter((id) => salida.includes(id));
        if (LA_PAPELERA.has(`${modulo}:${nombre}`)) continue;
        expect(encontrados, `${modulo}:${nombre} devuelve algo borrado`).toEqual([]);
      }
    }
  });

  it('borrar un capítulo lo saca de todas ellas, con sus subcapítulos y sus notas', async () => {
    const s = await sembrar();
    const borrados = [s.pagina.id, s.subpagina.id, s.notaDePagina.id];

    await s.asAna.mutation(api.pages.remove, { id: s.pagina.id });

    for (const modulo of ['folders', 'stickyNotes', 'pages']) {
      for (const nombre of await lecturasDe(modulo)) {
        const salida = await leer(s, modulo, nombre);
        if (LA_PAPELERA.has(`${modulo}:${nombre}`)) continue;
        expect(borrados.filter((id) => salida.includes(id)), `${modulo}:${nombre} devuelve algo borrado`).toEqual([]);
      }
    }
  });
});

describe('la papelera de carpetas', () => {
  it('enseña sólo la raíz del borrado y dice cuántas subcarpetas vuelven con ella', async () => {
    const s = await sembrar();
    await s.asAna.mutation(api.folders.remove, { id: s.raiz.id });

    const filas = await s.asAna.query(api.folders.trashed, {});

    expect(filas.map((f) => f.id)).toEqual([s.raiz.id]);
    expect(filas[0]!.subfolderCount).toBe(3);
  });

  it('restaurarla devuelve las cuatro y la nota que colgaba de ella', async () => {
    const s = await sembrar();
    await s.asAna.mutation(api.folders.remove, { id: s.raiz.id });

    await s.asAna.mutation(api.folders.restore, { id: s.raiz.id });

    const arbol = await s.asAna.query(api.folders.tree, {});
    expect(arbol.map((n) => n.id)).toEqual([s.raiz.id]);
    expect(arbol[0]!.children.map((n) => n.id).sort()).toEqual([s.hija.id, s.otraHija.id].sort());
    expect(arbol[0]!.children.find((n) => n.id === s.hija.id)!.children.map((n) => n.id)).toEqual([s.nieta.id]);
    expect((await s.asAna.query(api.stickyNotes.byFolder, { folderId: s.raiz.id })).map((n) => n.id)).toEqual([s.notaDeCarpeta.id]);
    expect(await s.asAna.query(api.folders.trashed, {})).toEqual([]);
  });

  it('lo que ya estaba en la papelera por su cuenta se queda ahí al restaurar la madre', async () => {
    const s = await sembrar();
    await s.asAna.mutation(api.folders.remove, { id: s.otraHija.id });
    await s.asAna.mutation(api.folders.remove, { id: s.raiz.id });

    await s.asAna.mutation(api.folders.restore, { id: s.raiz.id });

    expect((await s.asAna.query(api.folders.trashed, {})).map((f) => f.id)).toEqual([s.otraHija.id]);
    const arbol = await s.asAna.query(api.folders.tree, {});
    expect(arbol[0]!.children.map((n) => n.id)).toEqual([s.hija.id]);
  });

  it('la cuenta de al lado no ve la papelera ajena ni puede restaurar de ella', async () => {
    const s = await sembrar();
    await s.asAna.mutation(api.folders.remove, { id: s.raiz.id });
    const asBeto = s.t.withIdentity(beto);
    await asBeto.mutation(api.users.ensure, {});

    expect(await asBeto.query(api.folders.trashed, {})).toEqual([]);
    await expect(asBeto.mutation(api.folders.restore, { id: s.raiz.id })).rejects.toThrow();
  });
});

describe('la papelera de notas adhesivas', () => {
  it('una nota borrada sola vuelve sola, y conserva su ancla de texto', async () => {
    const s = await sembrar();
    const anclada = await s.asAna.mutation(api.stickyNotes.createOnPage, {
      pageId: s.pagina.id, content: 'Chéjov', textAnchor: 'la daga de obsidiana descansaba en el arcón',
    });

    await s.asAna.mutation(api.stickyNotes.remove, { id: anclada.id });
    expect((await s.asAna.query(api.stickyNotes.trashed, {})).map((n) => n.id)).toEqual([anclada.id]);
    const vuelta = await s.asAna.mutation(api.stickyNotes.restore, { id: anclada.id });

    expect(vuelta.textAnchor).toBe('la daga de obsidiana descansaba en el arcón');
    expect((await s.asAna.query(api.stickyNotes.byPage, { pageId: s.pagina.id })).map((n) => n.id)).toContain(anclada.id);
  });

  it('la que se fue con su carpeta no se lista aparte ni se restaura sola', async () => {
    const s = await sembrar();
    await s.asAna.mutation(api.folders.remove, { id: s.raiz.id });

    expect(await s.asAna.query(api.stickyNotes.trashed, {})).toEqual([]);
    await expect(s.asAna.mutation(api.stickyNotes.restore, { id: s.notaDeCarpeta.id })).rejects.toThrow();
  });

  it('cada nota nueva lleva el sistema de su dueño, que es lo que el contract va a exigir', async () => {
    const s = await sembrar();
    const docs = await s.t.run((ctx) => ctx.db.query('stickyNotes').collect());
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((doc) => doc.systemId === s.systemId)).toBe(true);
  });
});

describe('la papelera de capítulos', () => {
  it('restaurar el capítulo devuelve sus subcapítulos y sus notas', async () => {
    const s = await sembrar();
    await s.asAna.mutation(api.pages.remove, { id: s.pagina.id });
    expect((await s.asAna.query(api.pages.trashed, {})).map((p) => p.id)).toEqual([s.pagina.id]);

    await s.asAna.mutation(api.pages.restore, { id: s.pagina.id });

    expect((await s.asAna.query(api.pages.bySystem, { systemId: s.systemId })).items.map((p) => p.id).sort()).toEqual(
      [s.pagina.id, s.subpagina.id].sort(),
    );
    expect((await s.asAna.query(api.stickyNotes.byPage, { pageId: s.pagina.id })).map((n) => n.id)).toEqual([s.notaDePagina.id]);
  });
});

describe('la papelera de entidades', () => {
  it('restaurar la entidad la devuelve al universo y vuelve a contar sus menciones', async () => {
    const s = await sembrar();
    const entidad = await s.asAna.mutation(api.entities.create, { systemId: s.systemId, type: 'character', name: 'Obsidiana' });
    await s.asAna.mutation(api.pages.update, { id: s.pagina.id, content: '<p>Obsidiana empuñó la daga</p>' });
    expect((await s.asAna.query(api.entities.byId, { id: entidad.id })).appearances).toHaveLength(1);

    await s.asAna.mutation(api.entities.remove, { id: entidad.id });
    expect((await s.asAna.query(api.entities.trashed, {})).map((e) => e.id)).toEqual([entidad.id]);
    await s.asAna.mutation(api.entities.restore, { id: entidad.id });

    expect((await s.asAna.query(api.entities.bySystem, { systemId: s.systemId })).map((e) => e.id)).toEqual([entidad.id]);
    expect((await s.asAna.query(api.entities.byId, { id: entidad.id })).appearances).toHaveLength(1);
    expect(await s.asAna.query(api.entities.trashed, {})).toEqual([]);
  });
});
