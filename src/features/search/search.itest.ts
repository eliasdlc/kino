import { beforeEach, describe, expect, it } from 'vitest';
import { resetAndSeedActors, type Actors } from '@/shared/db/testing/harness';
import { createSystem } from '@/features/systems/systems.service';
import { createTask, deleteTask } from '@/features/tasks/tasks.service';
import { createPage } from '@/features/pages/pages.service';
import { searchAll } from '@/features/search/search.service';
import { SNIPPET_OPEN } from '@/features/search/search.types';

/**
 * La búsqueda del Cmd+K vive entera en SQL: una columna `tsvector` generada con
 * la configuración `spanish_unaccent` y un `to_tsquery` con prefijo en la última
 * palabra. Nada de eso se ve en TypeScript, y cada pieza falla distinto:
 *
 *  - sin el prefijo `:*`, el término a medio teclear no encuentra nada;
 *  - sin el stemmer español, "escribiendo" no encuentra "escribir";
 *  - sin `unaccent`, "manana" no encuentra "mañana" (el stemmer español quita
 *    los acentos agudos por su cuenta, pero la eñe no la toca).
 *
 * Cada test de abajo apunta a una de las tres.
 */

let actors: Actors;
let systemId: string;

beforeEach(async () => {
  actors = await resetAndSeedActors();
  systemId = (await createSystem(actors.alice, { name: 'Novela', color: 'blue', icon: 'folder' }))!.id;
});

const titlesOf = (results: Awaited<ReturnType<typeof searchAll>>) => results.map((r) => r.title);

describe('búsqueda · full-text en español', () => {
  it('un término a medio teclear encuentra la palabra completa', async () => {
    await createTask(actors.alice, { systemId, title: 'Escribir el capítulo tres' });

    expect(titlesOf(await searchAll(actors.alice, 'escrib'))).toContain('Escribir el capítulo tres');
  });

  // Esta es la que cae si se quita la configuración de idioma: con `simple` los
  // lexemas se guardan tal cual y "escribiendo" no comparte prefijo con "escribir".
  it('otra conjugación del mismo verbo encuentra la tarea', async () => {
    await createTask(actors.alice, { systemId, title: 'Escribir el capítulo tres' });

    expect(titlesOf(await searchAll(actors.alice, 'escribiendo'))).toContain('Escribir el capítulo tres');
  });

  it('buscar sin acentos encuentra lo acentuado', async () => {
    await createTask(actors.alice, { systemId, title: 'Reunión de mañana con la editorial' });

    expect(titlesOf(await searchAll(actors.alice, 'manana'))).toContain('Reunión de mañana con la editorial');
    expect(titlesOf(await searchAll(actors.alice, 'reunion'))).toContain('Reunión de mañana con la editorial');
  });

  it('un término que no está no devuelve nada', async () => {
    await createTask(actors.alice, { systemId, title: 'Escribir el capítulo tres' });

    expect(await searchAll(actors.alice, 'bicicleta')).toEqual([]);
  });

  it('el título pesa más que el cuerpo', async () => {
    await createTask(actors.alice, {
      systemId,
      title: 'Otra cosa',
      description: 'repasar el presupuesto de la gira antes del viernes',
    });
    await createTask(actors.alice, { systemId, title: 'Presupuesto de la gira' });

    const results = await searchAll(actors.alice, 'presupuesto');

    expect(titlesOf(results)[0]).toBe('Presupuesto de la gira');
  });

  it('el fragmento marca dónde apareció el término, y no lo repite si fue el título', async () => {
    await createTask(actors.alice, {
      systemId,
      title: 'Otra cosa',
      description: 'repasar el presupuesto de la gira antes del viernes',
    });
    await createTask(actors.alice, { systemId, title: 'Presupuesto de la gira' });

    const results = await searchAll(actors.alice, 'presupuesto');
    const porTitulo = results.find((r) => r.title === 'Presupuesto de la gira')!;
    const porCuerpo = results.find((r) => r.title === 'Otra cosa')!;

    expect(porTitulo.snippet).toBeNull();
    expect(porCuerpo.snippet).toContain(SNIPPET_OPEN);
  });

  // El contenido de una página es el HTML de Tiptap, y la columna generada lo
  // limpia con regexp antes de indexar. Sin esa limpieza se podría encontrar una
  // página buscando "span".
  it('el marcado de una página no entra en el índice, su texto sí', async () => {
    await createPage(actors.alice, {
      systemId,
      title: 'Notas del acto dos',
      content: '<p class="parrafo"><span data-entity-id="x">La protagonista</span> duda</p>',
    });

    expect(titlesOf(await searchAll(actors.alice, 'protagonista'))).toContain('Notas del acto dos');
    expect(await searchAll(actors.alice, 'span')).toEqual([]);
    expect(await searchAll(actors.alice, 'parrafo')).toEqual([]);
  });

  it('la búsqueda de A no ve nada de B', async () => {
    const bobSystem = (await createSystem(actors.bob, { name: 'Suyo', color: 'red', icon: 'folder' }))!;
    await createTask(actors.bob, { systemId: bobSystem.id, title: 'Escribir el capítulo tres' });

    expect(await searchAll(actors.alice, 'escrib')).toEqual([]);
  });

  it('una tarea en la papelera deja de aparecer', async () => {
    const task = (await createTask(actors.alice, { systemId, title: 'Escribir el capítulo tres' }))!;

    await deleteTask(task.id, actors.alice);

    expect(await searchAll(actors.alice, 'escrib')).toEqual([]);
  });
});
