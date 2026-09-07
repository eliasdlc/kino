/**
 * Qué se prueba: que la búsqueda ve las cinco fuentes, que cada resultado sabe
 * a dónde lleva, que dice cuántos quedaron fuera del tope, y que dos peticiones
 * iguales devuelven las mismas filas en el mismo orden aunque los rangos empaten.
 * Esto último es lo que hace innecesario el cursor: sin páginas no hay cursor
 * que se desestabilice, pero el orden sí tiene que ser el mismo dos veces.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function sembrar() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run((ctx) =>
    ctx.db.insert('systems', {
      userId, createdBy: userId, createdVia: 'session', name: 'Obsidiana', color: 'purple',
      templateType: 'writing', icon: 'book', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1,
    }),
  );
  const folderId = (await asAna.mutation(api.folders.create, { systemId, name: 'Parte 1' })).id;
  const pagina = await asAna.mutation(api.pages.create, { systemId, folderId, title: 'La daga', content: '<p>Filo de obsidiana</p>' });
  const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Pulir la obsidiana' });
  const nota = await asAna.mutation(api.stickyNotes.createOnPage, { pageId: pagina.id, content: 'Comprar obsidiana el martes' });
  const etiqueta = await asAna.mutation(api.tags.create, { systemId, title: 'obsidiana' });
  return { t, asAna, userId, systemId, folderId, pagina, tarea, nota, etiqueta };
}

describe('la búsqueda global', () => {
  it('encuentra la misma palabra en las cinco fuentes', async () => {
    const s = await sembrar();

    const { items } = await s.asAna.query(api.search.all, { q: 'obsidiana' });

    expect(items.filter((r) => r.type === 'task').map((r) => r.id)).toEqual([s.tarea.id]);
    expect(items.filter((r) => r.type === 'page').map((r) => r.id)).toEqual([s.pagina.id]);
    expect(items.filter((r) => r.type === 'note').map((r) => r.id)).toEqual([s.nota.id]);
    expect(items.filter((r) => r.type === 'tag').map((r) => r.id)).toEqual([s.etiqueta.id]);
    expect(items.filter((r) => r.type === 'system').map((r) => r.id)).toEqual([s.systemId]);
  });

  it('una palabra que sólo está en una nota adhesiva la encuentra igual', async () => {
    const s = await sembrar();

    const { items } = await s.asAna.query(api.search.all, { q: 'martes' });

    expect(items.map((r) => r.id)).toEqual([s.nota.id]);
    expect(items[0]!.href).toBe(`/systems/${s.systemId}/pages/${s.pagina.id}`);
  });

  it('una nota pegada a una carpeta lleva a la carpeta, no a ningún capítulo', async () => {
    const s = await sembrar();
    const enCarpeta = await s.asAna.mutation(api.stickyNotes.createOnFolder, { folderId: s.folderId, content: 'Falta el mapa del pueblo' });

    const { items } = await s.asAna.query(api.search.all, { q: 'mapa' });

    expect(items.map((r) => r.id)).toEqual([enCarpeta.id]);
    expect(items[0]!.href).toBe(`/systems/${s.systemId}/folders/${s.folderId}`);
  });

  it('cada resultado lleva a algún sitio: ninguno se pinta sin destino', async () => {
    const s = await sembrar();

    const { items } = await s.asAna.query(api.search.all, { q: 'obsidiana' });

    expect(items).not.toEqual([]);
    expect(items.filter((r) => !r.href.startsWith('/'))).toEqual([]);
  });

  it('dice cuántos quedaron fuera cuando una fuente pasa del tope', async () => {
    const s = await sembrar();
    for (let i = 0; i < 10; i += 1) {
      await s.asAna.mutation(api.tasks.create, { systemId: s.systemId, title: `Cortar cristal ${i}` });
    }

    const pagina = await s.asAna.query(api.search.all, { q: 'cristal' });

    expect(pagina.items.filter((r) => r.type === 'task')).toHaveLength(8);
    expect(pagina.restantes).toBe(2);
    expect(pagina.tope).toBe(false);
  });

  it('dos peticiones iguales devuelven las mismas filas en el mismo orden con rangos empatados', async () => {
    const s = await sembrar();
    for (let i = 0; i < 12; i += 1) {
      await s.asAna.mutation(api.stickyNotes.createOnPage, { pageId: s.pagina.id, content: 'cuerda de cáñamo' });
    }

    const primera = await s.asAna.query(api.search.all, { q: 'cuerda' });
    const segunda = await s.asAna.query(api.search.all, { q: 'cuerda' });

    expect(segunda.items.map((r) => r.id)).toEqual(primera.items.map((r) => r.id));
    expect(primera.items.filter((r) => r.type === 'note')).toHaveLength(8);
    expect(primera.restantes).toBe(4);
  });

  it('un término más corto que el mínimo no consulta nada', async () => {
    const s = await sembrar();

    expect(await s.asAna.query(api.search.all, { q: 'o' })).toEqual({ items: [], restantes: 0, tope: false });
  });
});
