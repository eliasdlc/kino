import { beforeEach, describe, expect, it } from 'vitest';
import { resetAndSeedActors, type Actors } from '@/shared/db/testing/harness';

import { createSystem, getSystemById, getUsersSystems, updateSystem, deactivateSystem } from '@/features/systems/systems.service';
import { createTask, getTaskById, updateTask, deleteTask, queryTasks, getTasksBySystem, bulkUpdateTasks, bulkMoveTasks } from '@/features/tasks/tasks.service';
import { createPage, getPageById, updatePage, deletePage, getPagesBySystem } from '@/features/pages/pages.service';
import { createFolder, getFolderById, updateFolder, deleteFolder, getFoldersBySystem } from '@/features/folders/folders.service';
import { createEntity, getEntityById, updateEntity, deleteEntity, listEntities } from '@/features/entities/entities.service';
import { createSprint, updateSprint, deleteSprint, getSprintsBySystem } from '@/features/sprints/sprints.service';
import { createStickyNote, updateStickyNote, deleteStickyNote, getStickyNotesByPage } from '@/features/sticky-notes/sticky-notes.service';
import { generateApiKey, listApiKeys, deleteApiKey, revokeApiKey } from '@/features/api-keys/api-keys.service';

/**
 * La garantía más importante del producto: que con la credencial de A no se
 * pueda tocar nada de B.
 *
 * Cada bloque hace las mismas cuatro preguntas sobre un recurso con dueño:
 * leerlo, actualizarlo, borrarlo y listarlo desde la cuenta equivocada. La
 * respuesta correcta a las cuatro es "nada", y "nada" tiene que incluir no
 * filtrar que el recurso existe.
 *
 * Corre contra un Postgres real (`pnpm test:integration`). Con `db` mockeado
 * sólo se comprobaría que la consulta lleva el filtro, no que la base lo
 * respete, y lo segundo es lo que importa aquí.
 */

let actors: Actors;

beforeEach(async () => {
  actors = await resetAndSeedActors();
});

/**
 * Un servicio se niega de dos formas según el caso: lanzando `NotFoundError` o
 * devolviendo `null`/`false`. Las dos son correctas y este helper acepta
 * ambas; lo que no acepta es que la operación funcione.
 *
 * Que se niegue no basta: cada test comprueba además que el dato de B sigue
 * como estaba, porque negar el resultado y haber escrito igual sería lo peor
 * de los dos mundos.
 */
async function refuses(action: Promise<unknown>) {
  const outcome = await action.then(
    (value) => ({ threw: false, value }),
    () => ({ threw: true, value: undefined }),
  );
  if (!outcome.threw) expect(outcome.value ?? false).toBeFalsy();
}

/** Un sistema por cuenta, que es de lo que cuelga todo lo demás. */
async function systemsForBoth() {
  const mine = await createSystem(actors.alice, { name: 'De Alice', color: 'blue', icon: 'folder' });
  const theirs = await createSystem(actors.bob, { name: 'De Bob', color: 'red', icon: 'folder' });
  return { mine: mine!, theirs: theirs! };
}

describe('aislamiento · systems', () => {
  it('A no puede leer el sistema de B', async () => {
    const { theirs } = await systemsForBoth();
    await expect(getSystemById(theirs.id, actors.alice)).resolves.toBeNull();
  });

  it('A no puede actualizar el sistema de B, y el sistema no cambia', async () => {
    const { theirs } = await systemsForBoth();
    await refuses(updateSystem(theirs.id, actors.alice, { name: 'Secuestrado' }));
    const after = await getSystemById(theirs.id, actors.bob);
    expect(after?.name).toBe('De Bob');
  });

  it('A no puede borrar el sistema de B, y el sistema sigue ahí', async () => {
    const { theirs } = await systemsForBoth();
    await refuses(deactivateSystem(theirs.id, actors.alice));
    await expect(getSystemById(theirs.id, actors.bob)).resolves.not.toBeNull();
  });

  it('la lista de A no incluye ningún sistema de B', async () => {
    const { theirs } = await systemsForBoth();
    const listed = await getUsersSystems(actors.alice);
    expect(listed.map((s) => s.id)).not.toContain(theirs.id);
  });
});

describe('aislamiento · tasks', () => {
  async function tasksForBoth() {
    const { mine, theirs } = await systemsForBoth();
    const myTask = (await createTask(actors.alice, { systemId: mine.id, title: 'Mía' }))!;
    const theirTask = (await createTask(actors.bob, { systemId: theirs.id, title: 'De Bob' }))!;
    return { mine, theirs, myTask, theirTask };
  }

  it('A no puede leer la tarea de B', async () => {
    const { theirTask } = await tasksForBoth();
    await expect(getTaskById(theirTask.id, actors.alice)).resolves.toBeNull();
  });

  it('A no puede actualizar la tarea de B', async () => {
    const { theirTask } = await tasksForBoth();
    await refuses(updateTask(theirTask.id, actors.alice, { title: 'Secuestrada' }));
    const after = await getTaskById(theirTask.id, actors.bob);
    expect(after?.title).toBe('De Bob');
  });

  it('A no puede borrar la tarea de B', async () => {
    const { theirTask } = await tasksForBoth();
    await refuses(deleteTask(theirTask.id, actors.alice));
    const after = await getTaskById(theirTask.id, actors.bob);
    expect(after).not.toBeNull();
    expect(after?.deletedAt).toBeNull();
  });

  it('ni la lista global ni la del sistema de B devuelven nada a A', async () => {
    const { theirs, theirTask } = await tasksForBoth();
    const global = await queryTasks(actors.alice, {});
    expect(global.map((t) => t.id)).not.toContain(theirTask.id);
    const bySystem = await getTasksBySystem(theirs.id, actors.alice);
    expect(bySystem).toHaveLength(0);
  });

  // El caso que el ticket pide explícitamente: ids ajenos mezclados en un lote.
  it('un bulk-update con ids de B aplica los de A e ignora los de B', async () => {
    const { myTask, theirTask } = await tasksForBoth();

    await bulkUpdateTasks([myTask.id, theirTask.id], { priority: 'critical' }, actors.alice);

    await expect(getTaskById(myTask.id, actors.alice)).resolves.toMatchObject({ priority: 'critical' });
    const theirs = await getTaskById(theirTask.id, actors.bob);
    expect(theirs?.priority).not.toBe('critical');
  });

  it('un bulk-move con ids de B mueve los de A y no toca los de B', async () => {
    const { myTask, theirTask } = await tasksForBoth();
    const before = (await getTaskById(theirTask.id, actors.bob))!.status;

    // El lote entero puede fallar por el id ajeno; lo que no puede es moverlo.
    await bulkMoveTasks([myTask.id, theirTask.id], 'today', actors.alice).catch(() => {});

    const after = await getTaskById(theirTask.id, actors.bob);
    expect(after?.status).toBe(before);
  });
});

describe('aislamiento · pages', () => {
  async function pagesForBoth() {
    const { mine, theirs } = await systemsForBoth();
    const myPage = await createPage(actors.alice, { systemId: mine.id, title: 'Mía' });
    const theirPage = await createPage(actors.bob, { systemId: theirs.id, title: 'De Bob' });
    return { mine, theirs, myPage, theirPage };
  }

  it('A no puede leer la página de B', async () => {
    const { theirPage } = await pagesForBoth();
    await expect(getPageById(theirPage.id, actors.alice)).resolves.toBeNull();
  });

  it('A no puede actualizar la página de B', async () => {
    const { theirPage } = await pagesForBoth();
    await refuses(updatePage(theirPage.id, actors.alice, { title: 'Secuestrada' }));
    const after = await getPageById(theirPage.id, actors.bob);
    expect(after?.title).toBe('De Bob');
  });

  it('A no puede borrar la página de B', async () => {
    const { theirPage } = await pagesForBoth();
    await refuses(deletePage(theirPage.id, actors.alice));
    await expect(getPageById(theirPage.id, actors.bob)).resolves.not.toBeNull();
  });

  it('listar las páginas del sistema de B no devuelve nada a A', async () => {
    const { theirs } = await pagesForBoth();
    await expect(getPagesBySystem(theirs.id, actors.alice)).resolves.toHaveLength(0);
  });
});

describe('aislamiento · folders', () => {
  async function foldersForBoth() {
    const { mine, theirs } = await systemsForBoth();
    const myFolder = await createFolder(actors.alice, { name: 'Mía', systemId: mine.id });
    const theirFolder = await createFolder(actors.bob, { name: 'De Bob', systemId: theirs.id });
    return { mine, theirs, myFolder, theirFolder };
  }

  it('A no puede leer la carpeta de B', async () => {
    const { theirFolder } = await foldersForBoth();
    await expect(getFolderById(theirFolder!.id, actors.alice)).resolves.toBeNull();
  });

  it('A no puede renombrar la carpeta de B', async () => {
    const { theirFolder } = await foldersForBoth();
    await refuses(updateFolder(theirFolder!.id, actors.alice, { name: 'Secuestrada' }));
    const after = await getFolderById(theirFolder!.id, actors.bob);
    expect(after?.name).toBe('De Bob');
  });

  it('A no puede borrar la carpeta de B', async () => {
    const { theirFolder } = await foldersForBoth();
    await refuses(deleteFolder(theirFolder!.id, actors.alice));
    await expect(getFolderById(theirFolder!.id, actors.bob)).resolves.not.toBeNull();
  });

  it('listar las carpetas del sistema de B no devuelve nada a A', async () => {
    const { theirs } = await foldersForBoth();
    await expect(getFoldersBySystem(theirs.id, actors.alice)).resolves.toHaveLength(0);
  });
});

describe('aislamiento · entities', () => {
  async function entitiesForBoth() {
    const { mine, theirs } = await systemsForBoth();
    const myEntity = await createEntity(actors.alice, { systemId: mine.id, type: 'character', name: 'Mía' });
    const theirEntity = await createEntity(actors.bob, { systemId: theirs.id, type: 'character', name: 'De Bob' });
    return { mine, theirs, myEntity, theirEntity };
  }

  it('A no puede leer la entidad de B', async () => {
    const { theirEntity } = await entitiesForBoth();
    await expect(getEntityById(theirEntity.id, actors.alice)).resolves.toBeNull();
  });

  it('A no puede actualizar la entidad de B', async () => {
    const { theirEntity } = await entitiesForBoth();
    await refuses(updateEntity(theirEntity.id, actors.alice, { name: 'Secuestrada' }));
    const after = await getEntityById(theirEntity.id, actors.bob);
    expect(after?.name).toBe('De Bob');
  });

  it('A no puede borrar la entidad de B', async () => {
    const { theirEntity } = await entitiesForBoth();
    await refuses(deleteEntity(theirEntity.id, actors.alice));
    await expect(getEntityById(theirEntity.id, actors.bob)).resolves.not.toBeNull();
  });

  it('listar el codex del sistema de B no devuelve nada a A', async () => {
    const { theirs } = await entitiesForBoth();
    await expect(listEntities(theirs.id, actors.alice)).resolves.toHaveLength(0);
  });
});

describe('aislamiento · sprints', () => {
  async function sprintsForBoth() {
    const { mine, theirs } = await systemsForBoth();
    const mySprint = await createSprint(actors.alice, { systemId: mine.id, name: 'Mío' });
    const theirSprint = await createSprint(actors.bob, { systemId: theirs.id, name: 'De Bob' });
    return { mine, theirs, mySprint, theirSprint };
  }

  it('A no puede renombrar el sprint de B', async () => {
    const { theirs, theirSprint } = await sprintsForBoth();
    await refuses(updateSprint(theirSprint!.id, actors.alice, { name: 'Secuestrado' }));
    const [after] = await getSprintsBySystem(theirs.id, actors.bob);
    expect(after?.name).toBe('De Bob');
  });

  it('A no puede borrar el sprint de B', async () => {
    const { theirs, theirSprint } = await sprintsForBoth();
    await refuses(deleteSprint(theirSprint!.id, actors.alice));
    await expect(getSprintsBySystem(theirs.id, actors.bob)).resolves.toHaveLength(1);
  });

  it('listar los sprints del sistema de B no devuelve nada a A', async () => {
    const { theirs } = await sprintsForBoth();
    await expect(getSprintsBySystem(theirs.id, actors.alice)).resolves.toHaveLength(0);
  });
});

describe('aislamiento · sticky notes', () => {
  async function notesForBoth() {
    const { mine, theirs } = await systemsForBoth();
    const myPage = await createPage(actors.alice, { systemId: mine.id, title: 'Mía' });
    const theirPage = await createPage(actors.bob, { systemId: theirs.id, title: 'De Bob' });
    const myNote = await createStickyNote(actors.alice, { pageId: myPage.id, content: 'Mía' });
    const theirNote = await createStickyNote(actors.bob, { pageId: theirPage.id, content: 'De Bob' });
    return { myPage, theirPage, myNote, theirNote };
  }

  it('A no puede editar la nota de B', async () => {
    const { theirPage, theirNote } = await notesForBoth();
    await refuses(updateStickyNote(theirNote!.id, actors.alice, { content: 'Secuestrada' }));
    const [after] = await getStickyNotesByPage(theirPage.id, actors.bob);
    expect(after?.content).toBe('De Bob');
  });

  it('A no puede borrar la nota de B', async () => {
    const { theirPage, theirNote } = await notesForBoth();
    await refuses(deleteStickyNote(theirNote!.id, actors.alice));
    await expect(getStickyNotesByPage(theirPage.id, actors.bob)).resolves.toHaveLength(1);
  });

  it('listar las notas de la página de B no devuelve nada a A', async () => {
    const { theirPage } = await notesForBoth();
    await expect(getStickyNotesByPage(theirPage.id, actors.alice)).resolves.toHaveLength(0);
  });
});

describe('aislamiento · api keys', () => {
  async function keysForBoth() {
    const mine = await generateApiKey(actors.alice, 'De Alice');
    const theirs = await generateApiKey(actors.bob, 'De Bob');
    return { mine, theirs };
  }

  it('la lista de A no incluye la clave de B', async () => {
    const { theirs } = await keysForBoth();
    const listed = await listApiKeys(actors.alice);
    expect(listed.map((k) => k.id)).not.toContain(theirs.record.id);
  });

  it('A no puede borrar la clave de B', async () => {
    const { theirs } = await keysForBoth();
    await expect(deleteApiKey(actors.alice, theirs.record.id)).resolves.toBe(false);
    await expect(listApiKeys(actors.bob)).resolves.toHaveLength(1);
  });

  // Revocar la clave de otro sería un denial of service con un id adivinado.
  it('A no puede revocar la clave de B', async () => {
    const { theirs } = await keysForBoth();
    await expect(revokeApiKey(actors.alice, theirs.record.id)).resolves.toBe(false);
    const [after] = await listApiKeys(actors.bob);
    expect(after?.revokedAt).toBeNull();
  });
});

/**
 * La otra mitad de la garantía: negar no basta si al negar cuentas algo.
 *
 * Pedir un recurso de B y pedir uno que no existe tienen que devolver
 * exactamente lo mismo. Si difirieran, un id adivinado se convertiría en un
 * oráculo de qué tiene la otra cuenta.
 */
describe('aislamiento · la respuesta no delata que el recurso existe', () => {
  const GHOST = '00000000-0000-4000-8000-000000000000';

  it('un sistema de B se lee igual que uno inexistente', async () => {
    const { theirs } = await systemsForBoth();
    expect(await getSystemById(theirs.id, actors.alice)).toEqual(
      await getSystemById(GHOST, actors.alice),
    );
  });

  it('una tarea de B se lee igual que una inexistente', async () => {
    const { theirs } = await systemsForBoth();
    const theirTask = (await createTask(actors.bob, { systemId: theirs.id, title: 'De Bob' }))!;
    expect(await getTaskById(theirTask.id, actors.alice)).toEqual(
      await getTaskById(GHOST, actors.alice),
    );
  });

  it('una página de B se lee igual que una inexistente', async () => {
    const { theirs } = await systemsForBoth();
    const theirPage = await createPage(actors.bob, { systemId: theirs.id, title: 'De Bob' });
    expect(await getPageById(theirPage.id, actors.alice)).toEqual(
      await getPageById(GHOST, actors.alice),
    );
  });

  it('una carpeta de B se lee igual que una inexistente', async () => {
    const { theirs } = await systemsForBoth();
    const theirFolder = await createFolder(actors.bob, { name: 'De Bob', systemId: theirs.id });
    expect(await getFolderById(theirFolder!.id, actors.alice)).toEqual(
      await getFolderById(GHOST, actors.alice),
    );
  });

  it('una entidad de B se lee igual que una inexistente', async () => {
    const { theirs } = await systemsForBoth();
    const theirEntity = await createEntity(actors.bob, {
      systemId: theirs.id,
      type: 'character',
      name: 'De Bob',
    });
    expect(await getEntityById(theirEntity.id, actors.alice)).toEqual(
      await getEntityById(GHOST, actors.alice),
    );
  });
});
