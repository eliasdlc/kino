import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/shared/db';
import { folders } from '@/shared/db/schema';
import { resetAndSeedActors, type Actors } from '@/shared/db/testing/harness';
import { createSystem } from '@/features/systems/systems.service';
import {
  createFolder,
  deleteFolder,
  getFolderBreadcrumb,
  getFolderById,
  getFolderChildren,
} from '@/features/folders/folders.service';

/**
 * La jerarquía de carpetas se resuelve con `ltree` en SQL crudo
 * (`folders.service.ts`, operador `@>` sobre un índice GiST). Drizzle no conoce
 * el operador, así que no hay tipo que avise si se invierte: leyendo el diff,
 * `@>` y `<@` se parecen demasiado. Sólo una base de verdad contesta cuál es.
 *
 * Un árbol de tres niveles es el mínimo donde la dirección importa: con dos, el
 * ancestro y el descendiente son el mismo par y la consulta invertida devuelve
 * lo mismo por casualidad.
 */

let actors: Actors;

beforeEach(async () => {
  actors = await resetAndSeedActors();
});

/** Curso → Unidad → Tema, el caso real de un sistema académico. */
async function threeLevelTree(userId: string) {
  const system = (await createSystem(userId, { name: 'Cálculo', color: 'blue', icon: 'folder' }))!;
  const curso = await createFolder(userId, { name: 'Curso', systemId: system.id });
  const unidad = await createFolder(userId, { name: 'Unidad 2', systemId: system.id, parentId: curso.id });
  const tema = await createFolder(userId, { name: 'Derivadas', systemId: system.id, parentId: unidad.id });
  return { system, curso, unidad, tema };
}

/** El path vive en la fila, no en lo que devuelve `createFolder`. */
async function pathOf(folderId: string, userId: string) {
  const folder = await getFolderById(folderId, userId);
  return folder!.path;
}

describe('jerarquía · ltree', () => {
  it('el breadcrumb del nieto son sus dos ancestros, de la raíz hacia abajo', async () => {
    const { curso, unidad, tema } = await threeLevelTree(actors.alice);

    const crumbs = await getFolderBreadcrumb(await pathOf(tema.id, actors.alice), actors.alice);

    expect(crumbs.map((c) => c.id)).toEqual([curso.id, unidad.id]);
    expect(crumbs.map((c) => c.name)).toEqual(['Curso', 'Unidad 2']);
  });

  // El test que distingue `@>` de `<@`: una raíz no tiene ancestros, pero sí
  // descendientes. Con el operador invertido esto devolvería el árbol entero.
  it('una raíz no tiene ancestros', async () => {
    const { curso } = await threeLevelTree(actors.alice);

    const crumbs = await getFolderBreadcrumb(await pathOf(curso.id, actors.alice), actors.alice);

    expect(crumbs).toEqual([]);
  });

  it('una rama hermana no aparece en el breadcrumb de la otra', async () => {
    const { system, curso, tema } = await threeLevelTree(actors.alice);
    const otra = await createFolder(actors.alice, {
      name: 'Unidad 3',
      systemId: system.id,
      parentId: curso.id,
    });

    const crumbs = await getFolderBreadcrumb(await pathOf(tema.id, actors.alice), actors.alice);

    expect(crumbs.map((c) => c.id)).not.toContain(otra.id);
  });

  // La consulta cruda lleva su propio `user_id = $1`; ningún filtro de Drizzle
  // la cubre. Para que el path de B sea ancestro del de A hay que escribirlo a
  // mano: por la API no se puede colgar una carpeta del árbol de otro.
  it('el breadcrumb no cruza de usuario aunque el path coincida', async () => {
    const { curso, tema } = await threeLevelTree(actors.alice);
    const bobSystem = (await createSystem(actors.bob, { name: 'De Bob', color: 'red', icon: 'folder' }))!;

    await db.insert(folders).values({
      userId: actors.bob,
      systemId: bobSystem.id,
      name: 'Intruso',
      path: await pathOf(curso.id, actors.alice),
    });

    const crumbs = await getFolderBreadcrumb(await pathOf(tema.id, actors.alice), actors.alice);

    expect(crumbs.map((c) => c.name)).toEqual(['Curso', 'Unidad 2']);
  });

  it('borrar la raíz se lleva a toda la descendencia', async () => {
    const { curso, unidad, tema } = await threeLevelTree(actors.alice);

    await deleteFolder(curso.id, actors.alice);

    await expect(getFolderById(unidad.id, actors.alice)).resolves.toBeNull();
    await expect(getFolderById(tema.id, actors.alice)).resolves.toBeNull();
  });

  it('los hijos directos de un nivel son sólo los suyos', async () => {
    const { curso, unidad, tema } = await threeLevelTree(actors.alice);

    const hijosDelCurso = await getFolderChildren(curso.id, actors.alice);
    const hijosDeLaUnidad = await getFolderChildren(unidad.id, actors.alice);

    expect(hijosDelCurso.map((f) => f.id)).toEqual([unidad.id]);
    expect(hijosDeLaUnidad.map((f) => f.id)).toEqual([tema.id]);
  });
});
