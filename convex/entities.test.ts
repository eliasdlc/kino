/**
 * Qué se prueba: el grafo del universo, la lectura más cara del codex.
 *
 * Dos criterios. Que el grafo de un sistema devuelve sus nodos, sus aristas y
 * sus obras, y ninguna fila del sistema de al lado. Y que lo que abre para
 * conseguirlo no crece con los capítulos: la restricción 9 de AGENTS.md acota
 * lo que una query *lee*, no lo que devuelve, y cada `useConvexQuery` es una
 * suscripción que relee todo eso en cada escritura que la toque.
 *
 * La medida del segundo criterio se cuenta, no se afirma: `medir` envuelve el
 * `db` con un espía que suma consultas y documentos.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { graphOf } from './entities';
import { espiar, type Cuenta } from './lib/espia';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/** El grafo de un sistema, con la cuenta de lo que hizo falta leer. */
async function medir(t: ReturnType<typeof convexTest>, userId: Id<'users'>, systemId: Id<'systems'>) {
  const cuenta: Cuenta = { consultas: 0, documentos: 0 };
  const grafo = await t.run((ctx) => graphOf({ ...ctx, db: espiar(ctx.db, cuenta) }, userId, systemId));
  return { ...cuenta, grafo };
}

/**
 * Un universo con dos obras, tres entidades vivas y una en la papelera, cuatro
 * capítulos (uno borrado) y un sistema vecino más poblado, que es lo que hace
 * que una lectura sin rango se note en la cuenta.
 */
async function sembrar(t: ReturnType<typeof convexTest>) {
  const as = t.withIdentity(ana);
  const userId = await as.mutation(api.users.ensure, {});
  const novela = await as.mutation(api.systems.create, { name: 'Novela', color: 'blue', templateType: 'writing', icon: 'book' });
  const vecina = await as.mutation(api.systems.create, { name: 'Vecina', color: 'green', templateType: 'writing', icon: 'book' });

  const marta = await as.mutation(api.entities.create, { systemId: novela.id, type: 'character', name: 'Marta' });
  const luis = await as.mutation(api.entities.create, { systemId: novela.id, type: 'character', name: 'Luis' });
  const obsidiana = await as.mutation(api.entities.create, { systemId: novela.id, type: 'location', name: 'Obsidiana' });
  const fantasma = await as.mutation(api.entities.create, { systemId: novela.id, type: 'character', name: 'Fantasma' });

  // El sistema vecino comparte nombre de entidad a propósito: si algo se colara
  // por nombre en vez de por sistema, se vería aquí.
  const martaVecina = await as.mutation(api.entities.create, { systemId: vecina.id, type: 'character', name: 'Marta' });
  const sombra = await as.mutation(api.entities.create, { systemId: vecina.id, type: 'character', name: 'Sombra' });
  await as.mutation(api.entities.create, { systemId: vecina.id, type: 'object', name: 'Daga' });

  // Zafiro primero: las obras salen ordenadas por nombre, no por creación.
  const zafiro = await as.mutation(api.folders.create, { systemId: novela.id, name: 'Zafiro' });
  const elAlba = await as.mutation(api.folders.create, { systemId: novela.id, name: 'El alba' });
  const vecinaUno = await as.mutation(api.folders.create, { systemId: vecina.id, name: 'Tomo I' });
  await as.mutation(api.folders.create, { systemId: vecina.id, name: 'Tomo II' });

  await as.mutation(api.pages.create, { systemId: novela.id, folderId: zafiro.id, title: 'Uno', content: '<p>Marta llamó a Marta y después a Luis.</p>' });
  await as.mutation(api.pages.create, { systemId: novela.id, folderId: elAlba.id, title: 'Dos', content: '<p>Marta camina sola.</p>' });
  await as.mutation(api.pages.create, { systemId: novela.id, title: 'Tres', content: '<p>Obsidiana brilla en la cueva.</p>' });
  const enPapelera = await as.mutation(api.pages.create, { systemId: novela.id, folderId: zafiro.id, title: 'Cuatro', content: '<p>Luis desaparece.</p>' });
  // Un capítulo que no nombra a nadie, para que el número de capítulos vivos no
  // coincida con el de entidades y la medida no se lea sola.
  await as.mutation(api.pages.create, { systemId: novela.id, folderId: elAlba.id, title: 'Cinco', content: '<p>La lluvia no deja dormir.</p>' });
  const capituloVecino = await as.mutation(api.pages.create, { systemId: vecina.id, folderId: vecinaUno.id, title: 'Vecino', content: '<p>Marta y Sombra cruzan el puente.</p>' });
  for (const n of [1, 2, 3, 4, 5]) {
    await as.mutation(api.pages.create, { systemId: vecina.id, folderId: vecinaUno.id, title: `Vecino ${n}`, content: '<p>Sombra vuelve con Marta.</p>' });
  }

  const hermana = await as.mutation(api.entities.createRelation, { id: marta.id, toEntityId: luis.id, label: 'hermana de' });
  const guarda = await as.mutation(api.entities.createRelation, { id: luis.id, toEntityId: obsidiana.id });
  // Dos aristas que no se dibujan: una cruza al sistema vecino y la otra acaba
  // en una entidad que se va a la papelera.
  await as.mutation(api.entities.createRelation, { id: obsidiana.id, toEntityId: martaVecina.id, label: 'ecos de' });
  await as.mutation(api.entities.createRelation, { id: marta.id, toEntityId: fantasma.id, label: 'sueña con' });
  await as.mutation(api.entities.createRelation, { id: martaVecina.id, toEntityId: sombra.id, label: 'teme a' });

  await as.mutation(api.pages.remove, { id: enPapelera.id });
  await as.mutation(api.entities.remove, { id: fantasma.id });

  return {
    as,
    userId,
    novelaId: novela.id as Id<'systems'>,
    vecinaId: vecina.id as Id<'systems'>,
    marta,
    luis,
    obsidiana,
    zafiro,
    elAlba,
    hermana,
    guarda,
    capituloVecinoId: capituloVecino.id as Id<'pages'>,
  };
}

describe('el grafo del universo', () => {
  it('devuelve los nodos, las aristas y las obras del sistema, y nada del de al lado', async () => {
    const t = convexTest(schema, modules);
    const s = await sembrar(t);

    expect(await s.as.query(api.entities.graph, { systemId: s.novelaId })).toEqual({
      nodes: [
        { id: s.luis.id, name: 'Luis', type: 'character', mentionCount: 1, workIds: [s.zafiro.id] },
        // Dos menciones en el primer capítulo y una en el segundo, y por eso
        // aparece en las dos obras, en el orden en que se recorren.
        { id: s.marta.id, name: 'Marta', type: 'character', mentionCount: 3, workIds: [s.zafiro.id, s.elAlba.id] },
        // El capítulo que la nombra no cuelga de ninguna obra.
        { id: s.obsidiana.id, name: 'Obsidiana', type: 'location', mentionCount: 1, workIds: [] },
      ],
      edges: [
        { id: s.guarda.id, from: s.luis.id, to: s.obsidiana.id, label: null },
        { id: s.hermana.id, from: s.marta.id, to: s.luis.id, label: 'hermana de' },
      ],
      works: [
        { id: s.elAlba.id, name: 'El alba' },
        { id: s.zafiro.id, name: 'Zafiro' },
      ],
    });
  });

  it('no cuenta la mención que apunta a un capítulo de otro sistema', async () => {
    const t = convexTest(schema, modules);
    const s = await sembrar(t);
    // Una fila derivada que el producto nunca escribe, porque las menciones se
    // recalculan contra el universo del sistema de la página. Existe aquí para
    // fijar cuál es el filtro: el capítulo, no la entidad.
    await t.run(async (ctx) => {
      await ctx.db.insert('pageEntityMentions', {
        pageId: s.capituloVecinoId,
        entityId: s.marta.id as Id<'entities'>,
        mentionCount: 7,
      });
    });

    const grafo = await s.as.query(api.entities.graph, { systemId: s.novelaId });
    expect(grafo.nodes.find((n) => n.id === s.marta.id)).toEqual({
      id: s.marta.id,
      name: 'Marta',
      type: 'character',
      mentionCount: 3,
      workIds: [s.zafiro.id, s.elAlba.id],
    });
  });
});

describe('lo que el grafo lee', () => {
  it('no crece con los capítulos del sistema: lo fijan sus entidades', async () => {
    const t = convexTest(schema, modules);
    const s = await sembrar(t);

    const antes = await medir(t, s.userId, s.novelaId);
    // El espía mide la misma lectura que sirve la query, no una copia suya.
    expect(antes.grafo).toEqual(await s.as.query(api.entities.graph, { systemId: s.novelaId }));
    // Tres consultas fijas (entidades, obras, capítulos) y dos por entidad
    // viva: sus menciones y sus relaciones.
    expect(antes.consultas).toBe(3 + 2 * 3);

    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      await s.as.mutation(api.pages.create, { systemId: s.novelaId, title: `Capítulo ${n}`, content: '<p>Marta insiste.</p>' });
    }

    const despues = await medir(t, s.userId, s.novelaId);
    expect(despues.consultas).toBe(antes.consultas);
    // Los doce capítulos nuevos y sus doce menciones sí se leen, pero dentro de
    // las consultas que ya había: eso es acotar el rango, no dejar de mirar.
    expect(despues.documentos).toBe(antes.documentos + 24);
    expect(despues.grafo.nodes.find((n) => n.id === s.marta.id)?.mentionCount).toBe(15);
  });

  it('no toca ninguna fila del sistema vecino', async () => {
    const t = convexTest(schema, modules);
    const s = await sembrar(t);

    const { documentos } = await medir(t, s.userId, s.novelaId);
    // Las filas de la Novela, una a una: 3 entidades vivas, 2 obras, 5
    // capítulos (uno en la papelera, que sigue siendo una fila), 4 menciones y
    // 4 relaciones que salen de sus entidades. La Vecina tiene 3 entidades, 2
    // obras, 6 capítulos, sus menciones y sus relaciones, y ninguna de esas
    // filas entra en esta cuenta.
    expect(documentos).toBe(3 + 2 + 5 + 4 + 4);
  });
});
