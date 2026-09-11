/**
 * Qué se prueba: que el manifiesto del export cubre el schema entero y que lo
 * que declara que viaja, viaja de verdad.
 *
 * El defecto que evita es el que traía este ticket: la pantalla prometía el
 * workspace completo mientras el ZIP se llevaba cuatro tablas de treinta y
 * seis. Con este test, una tabla nueva en `schema.ts` rompe la batería hasta
 * que alguien decide si viaja y en qué formato.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import { EXPORT_TABLES, EXPORTED_TABLES } from '../src/features/settings/export-manifest';
import { LECTORES } from './portabilidad';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };

describe('el manifiesto del export', () => {
  it('clasifica todas las tablas del schema, ninguna de más y ninguna de menos', () => {
    const enElSchema = Object.keys(schema.tables).sort();
    const enElManifiesto = EXPORT_TABLES.map((t) => t.tabla).sort();

    expect(enElManifiesto).toEqual(enElSchema);
    console.log(`export: ${EXPORTED_TABLES.length} de ${EXPORT_TABLES.length} tablas viajan`);
  });

  it('la que no viaja dice por qué, y la que viaja dice en qué formato', () => {
    for (const { tabla, formato, motivo } of EXPORT_TABLES) {
      if (formato === null) expect(motivo, `${tabla} no viaja y no dice por qué`).toBeTruthy();
      else expect(motivo, `${tabla} viaja y aun así da un motivo para no hacerlo`).toBeUndefined();
    }
  });

  it('cada tabla que viaja tiene quien la lea', () => {
    expect(EXPORTED_TABLES.filter((t) => LECTORES[t.tabla] === undefined).map((t) => t.tabla)).toEqual([]);
  });
});

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
  const folder = await asAna.mutation(api.folders.create, { systemId, name: 'Parte 1' });
  const pagina = await asAna.mutation(api.pages.create, { systemId, folderId: folder.id, title: 'La daga', content: '<p>Obsidiana</p>' });
  const tarea = await asAna.mutation(api.tasks.create, { systemId, title: 'Pulir el filo' });
  await asAna.mutation(api.stickyNotes.createOnPage, { pageId: pagina.id, content: 'Revisar el filo' });
  await asAna.mutation(api.tags.create, { systemId, title: 'urgente' });
  const entidad = await asAna.mutation(api.entities.create, { systemId, type: 'character', name: 'Obsidiana' });
  const otra = await asAna.mutation(api.entities.create, { systemId, type: 'character', name: 'Sílex' });
  await asAna.mutation(api.entities.createRelation, { id: entidad.id, toEntityId: otra.id, label: 'hermana' });
  await asAna.mutation(api.pages.linkTask, { id: pagina.id, taskId: tarea.id });
  // El texto menciona a la entidad, así que `pageEntityMentions` tiene fila.
  await asAna.mutation(api.pages.update, { id: pagina.id, content: '<p>Obsidiana empuñó la daga</p>' });
  return { t, asAna, userId, systemId, pagina, tarea };
}

describe('la lectura del workspace', () => {
  it('trae lo sembrado en cada tabla que declara que viaja', async () => {
    const s = await sembrar();

    const { tablas } = await s.asAna.query(api.portabilidad.workspace, {});

    for (const tabla of ['users', 'systems', 'tasks', 'folders', 'pages', 'stickyNotes', 'contextTags', 'entities', 'entityRelations', 'taskPageLinks', 'pageEntityMentions']) {
      expect(tablas[tabla], `${tabla} viaja vacía`).not.toHaveLength(0);
    }
    expect(Object.keys(tablas).sort()).toEqual(EXPORTED_TABLES.map((t) => t.tabla).sort());
  });

  it('el capítulo viaja con su contenido: sin él el Markdown saldría en blanco', async () => {
    const s = await sembrar();

    const { tablas } = await s.asAna.query(api.portabilidad.workspace, {});

    expect((tablas.pages as Array<{ content?: string }>)[0]!.content).toContain('Obsidiana');
  });

  it('la cuenta de al lado no se lleva nada de la primera', async () => {
    const s = await sembrar();
    const asBeto = s.t.withIdentity(beto);
    await asBeto.mutation(api.users.ensure, {});

    const { tablas } = await asBeto.query(api.portabilidad.workspace, {});

    expect(tablas.systems).toEqual([]);
    expect(tablas.pages).toEqual([]);
    expect(tablas.stickyNotes).toEqual([]);
    expect(tablas.entityRelations).toEqual([]);
    // La suya sí: una fila, la de su propia cuenta.
    expect(tablas.users).toHaveLength(1);
  });
});
