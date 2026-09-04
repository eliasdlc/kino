// Cada ON DELETE del schema de Postgres que viaja a Convex, y la mutación que
// tiene que reproducirlo a mano, porque Convex no tiene cascadas. Es la lista
// que el ticket de cascadas de la fase 1 recorre; un test la mantiene igual a
// lo que el schema de Drizzle declara.

import type { TableNames } from '../../convex/_generated/dataModel';

export type Cascade = {
  /** Tabla que tiene la referencia. */
  from: TableNames;
  field: string;
  /** Tabla borrada. */
  to: TableNames;
  onDelete: 'cascade' | 'set null';
  /** Mutación de Convex que ejecuta el borrado y tiene que hacer esto. */
  mutation: string;
};

export const CASCADES: Cascade[] = [
  // Borrar la cuenta se lleva todo lo suyo. Es la única cascada que toca
  // dieciocho tablas y por eso es una acción por lotes, no una mutación.
  ...(
    [
      'userSettings',
      'userEnergyProfile',
      'systems',
      'contextTags',
      'tasks',
      'sprints',
      'folders',
      'pages',
      'stickyNotes',
      'pageSnapshots',
      'entities',
      'taskReminders',
      'timeLogs',
      'syncConnections',
      'pushSubscriptions',
      'energyCheckins',
      'energyPredictions',
      'behaviorSnapshots',
    ] satisfies TableNames[]
  ).map(
    (from): Cascade => ({ from, field: 'userId', to: 'users', onDelete: 'cascade', mutation: 'users.remove' }),
  ),

  { from: 'contextTags', field: 'systemId', to: 'systems', onDelete: 'cascade', mutation: 'systems.remove' },
  { from: 'tasks', field: 'systemId', to: 'systems', onDelete: 'cascade', mutation: 'systems.remove' },
  { from: 'sprints', field: 'systemId', to: 'systems', onDelete: 'cascade', mutation: 'systems.remove' },
  { from: 'folders', field: 'systemId', to: 'systems', onDelete: 'set null', mutation: 'systems.remove' },
  { from: 'pages', field: 'systemId', to: 'systems', onDelete: 'set null', mutation: 'systems.remove' },
  { from: 'entities', field: 'systemId', to: 'systems', onDelete: 'cascade', mutation: 'systems.remove' },
  { from: 'timeLogs', field: 'systemId', to: 'systems', onDelete: 'cascade', mutation: 'systems.remove' },

  { from: 'tasks', field: 'parentTaskId', to: 'tasks', onDelete: 'cascade', mutation: 'tasks.remove' },
  { from: 'tasks', field: 'recurrenceParentId', to: 'tasks', onDelete: 'set null', mutation: 'tasks.remove' },
  { from: 'taskPageLinks', field: 'taskId', to: 'tasks', onDelete: 'cascade', mutation: 'tasks.remove' },
  { from: 'timeLogs', field: 'taskId', to: 'tasks', onDelete: 'cascade', mutation: 'tasks.remove' },
  { from: 'taskReminders', field: 'taskId', to: 'tasks', onDelete: 'cascade', mutation: 'tasks.remove' },

  { from: 'folders', field: 'parentId', to: 'folders', onDelete: 'cascade', mutation: 'folders.remove' },
  { from: 'tasks', field: 'folderId', to: 'folders', onDelete: 'set null', mutation: 'folders.remove' },
  { from: 'pages', field: 'folderId', to: 'folders', onDelete: 'set null', mutation: 'folders.remove' },
  { from: 'stickyNotes', field: 'folderId', to: 'folders', onDelete: 'cascade', mutation: 'folders.remove' },

  { from: 'tasks', field: 'contextTagId', to: 'contextTags', onDelete: 'set null', mutation: 'tags.remove' },
  { from: 'pageTags', field: 'tagId', to: 'contextTags', onDelete: 'cascade', mutation: 'tags.remove' },

  { from: 'tasks', field: 'sprintId', to: 'sprints', onDelete: 'set null', mutation: 'sprints.remove' },

  { from: 'pages', field: 'parentPageId', to: 'pages', onDelete: 'cascade', mutation: 'pages.remove' },
  { from: 'taskPageLinks', field: 'pageId', to: 'pages', onDelete: 'cascade', mutation: 'pages.remove' },
  { from: 'pageTags', field: 'pageId', to: 'pages', onDelete: 'cascade', mutation: 'pages.remove' },
  { from: 'pageSnapshots', field: 'pageId', to: 'pages', onDelete: 'cascade', mutation: 'pages.remove' },
  { from: 'pageEntityMentions', field: 'pageId', to: 'pages', onDelete: 'cascade', mutation: 'pages.remove' },
  { from: 'stickyNotes', field: 'pageId', to: 'pages', onDelete: 'cascade', mutation: 'pages.remove' },
  { from: 'timeLogs', field: 'pageId', to: 'pages', onDelete: 'cascade', mutation: 'pages.remove' },

  { from: 'entityRelations', field: 'fromEntityId', to: 'entities', onDelete: 'cascade', mutation: 'entities.remove' },
  { from: 'entityRelations', field: 'toEntityId', to: 'entities', onDelete: 'cascade', mutation: 'entities.remove' },
  { from: 'pageEntityMentions', field: 'entityId', to: 'entities', onDelete: 'cascade', mutation: 'entities.remove' },
];
