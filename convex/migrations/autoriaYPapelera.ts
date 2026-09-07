import { Migrations } from '@convex-dev/migrations';
import { components, internal } from '../_generated/api';
import { internalMutation } from '../_generated/server';
import type { DataModel, Id } from '../_generated/dataModel';
import { PROJECT_BOARD_COLUMNS } from '../../src/shared/lib/system-types';

// ════════════════════════════════════════════════════════════════════════════
// Autoría y papelera
// ════════════════════════════════════════════════════════════════════════════
//
// Rellena los campos que el schema declaró opcionales para que existieran
// antes de tener quién los escribiera. Después de correrla, y sólo después,
// `createdBy` y `createdVia` dejan de ser opcionales en el schema: primero el
// dato en todos los documentos, luego el contrato. Nunca en el mismo deploy.
//
// ── Qué rellena, campo por campo ───────────────────────────────────────────
//
//   tasks.createdBy          ← doc.userId
//   tasks.createdVia         ← 'sync' si la tarea vino de un issue de GitHub
//                              (`externalSource` puesto), 'session' si no.
//   tasks.completedBy        ← doc.userId, sólo si tiene `completedAt`.
//   tasks.completedVia       ← igual criterio que `createdVia`, sólo si tiene
//                              `completedAt`. Sin cierre no se escriben: estos
//                              dos siguen opcionales por naturaleza.
//
//   pages.createdBy          ← doc.userId
//   pages.createdVia         ← 'session'
//   pages.completedBy        ← doc.userId, sólo si tiene `completedAt`.
//   pages.completedVia       ← 'session', sólo si tiene `completedAt`.
//
//   folders.createdBy        ← doc.userId
//   folders.createdVia       ← 'session'
//
//   stickyNotes.createdBy    ← doc.userId
//   stickyNotes.createdVia   ← 'session'
//   stickyNotes.systemId     ← el `systemId` de su página, o el de su carpeta.
//                              Sigue opcional: la página y la carpeta también
//                              lo tienen opcional, así que ningún escritor
//                              puede garantizarlo.
//
//   systems.createdBy        ← doc.userId
//   systems.createdVia       ← 'system' si es el Inbox (lo crea Kino, no una
//                              persona), 'session' en el resto.
//
//   entities.createdBy       ← doc.userId
//   entities.createdVia      ← 'session'
//
//   pageSnapshots.systemId   ← el `systemId` de su página. Sigue opcional por
//                              la misma razón que en stickyNotes.
//
//   systemStatusDefinitions  ← las columnas del tablero de un sistema de tipo
//                              proyecto, copiadas de PROJECT_BOARD_COLUMNS.
//                              Sin ellas el kanban de un proyecto arranca
//                              vacío en un deployment nuevo.
//
// `deletedAt` en folders y stickyNotes no se rellena: ausente significa vivo,
// que es exactamente lo que son todos los documentos de hoy. Lo que cambia en
// este ticket es quién lo escribe, no el dato: `folders.remove` y
// `stickyNotes.remove` pasan a marcar en vez de destruir.
//
// `users.lastActiveAt` y `userEnergyProfile.ceilingMutedAt` tampoco se
// rellenan. Inventar una fecha de última actividad sería inventar un dato:
// ausente es la verdad hasta que la persona vuelva a entrar.
//
// ── Canal ──────────────────────────────────────────────────────────────────
// El plan de la fase pedía rellenar con el canal `web`. No existe: el enum
// `actorChannel` del schema es 'session' | 'oauth' | 'sync' | 'system', y el
// equivalente de "una persona en el navegador" es 'session'. Manda el repo.
//
// ── Idempotencia ───────────────────────────────────────────────────────────
// Cada paso comprueba antes de escribir, así que reejecutar la migración no
// toca ningún documento. El componente además guarda el estado de cada una,
// de modo que una segunda pasada ni siquiera recorre lo ya hecho.
//
// ── Cómo se corre ──────────────────────────────────────────────────────────
//   npx convex run migrations/autoriaYPapelera:run
// o una suelta:
//   npx convex run migrations/autoriaYPapelera:tasksAutoria

export const migrations = new Migrations<DataModel>(components.migrations);

// ── Autoría ────────────────────────────────────────────────────────────────

export const tasksAutoria = migrations.define({
  table: 'tasks',
  migrateOne: (_ctx, doc) => {
    if (doc.createdBy !== undefined && doc.createdVia !== undefined) return;
    const via = doc.externalSource !== undefined ? ('sync' as const) : ('session' as const);
    return {
      createdBy: doc.createdBy ?? doc.userId,
      createdVia: doc.createdVia ?? via,
    };
  },
});

export const pagesAutoria = migrations.define({
  table: 'pages',
  migrateOne: (_ctx, doc) => {
    if (doc.createdBy !== undefined && doc.createdVia !== undefined) return;
    return {
      createdBy: doc.createdBy ?? doc.userId,
      createdVia: doc.createdVia ?? ('session' as const),
    };
  },
});

export const foldersAutoria = migrations.define({
  table: 'folders',
  migrateOne: (_ctx, doc) => {
    if (doc.createdBy !== undefined && doc.createdVia !== undefined) return;
    return {
      createdBy: doc.createdBy ?? doc.userId,
      createdVia: doc.createdVia ?? ('session' as const),
    };
  },
});

export const systemsAutoria = migrations.define({
  table: 'systems',
  migrateOne: (_ctx, doc) => {
    if (doc.createdBy !== undefined && doc.createdVia !== undefined) return;
    return {
      createdBy: doc.createdBy ?? doc.userId,
      createdVia: doc.createdVia ?? (doc.isInbox ? ('system' as const) : ('session' as const)),
    };
  },
});

export const entitiesAutoria = migrations.define({
  table: 'entities',
  migrateOne: (_ctx, doc) => {
    if (doc.createdBy !== undefined && doc.createdVia !== undefined) return;
    return {
      createdBy: doc.createdBy ?? doc.userId,
      createdVia: doc.createdVia ?? ('session' as const),
    };
  },
});

// La nota adhesiva rellena autoría y sistema en la misma pasada: las dos
// salen de la misma lectura de su página o su carpeta.
export const stickyNotesAutoriaYSistema = migrations.define({
  table: 'stickyNotes',
  migrateOne: async (ctx, doc) => {
    const patch: {
      createdBy?: Id<'users'>;
      createdVia?: 'session';
      systemId?: Id<'systems'>;
    } = {};
    if (doc.createdBy === undefined) patch.createdBy = doc.userId;
    if (doc.createdVia === undefined) patch.createdVia = 'session';
    if (doc.systemId === undefined) {
      const owner = doc.pageId
        ? await ctx.db.get(doc.pageId)
        : doc.folderId
          ? await ctx.db.get(doc.folderId)
          : null;
      if (owner?.systemId) patch.systemId = owner.systemId;
    }
    if (Object.keys(patch).length === 0) return;
    return patch;
  },
});

// ── Cierre ─────────────────────────────────────────────────────────────────

export const tasksCierre = migrations.define({
  table: 'tasks',
  migrateOne: (_ctx, doc) => {
    if (doc.completedAt === undefined) return;
    if (doc.completedBy !== undefined && doc.completedVia !== undefined) return;
    const via = doc.externalSource !== undefined ? ('sync' as const) : ('session' as const);
    return {
      completedBy: doc.completedBy ?? doc.userId,
      completedVia: doc.completedVia ?? via,
    };
  },
});

export const pagesCierre = migrations.define({
  table: 'pages',
  migrateOne: (_ctx, doc) => {
    if (doc.completedAt === undefined) return;
    if (doc.completedBy !== undefined && doc.completedVia !== undefined) return;
    return {
      completedBy: doc.completedBy ?? doc.userId,
      completedVia: doc.completedVia ?? ('session' as const),
    };
  },
});

// ── Sistema de las versiones de un capítulo ────────────────────────────────

export const pageSnapshotsSistema = migrations.define({
  table: 'pageSnapshots',
  migrateOne: async (ctx, doc) => {
    if (doc.systemId !== undefined) return;
    const page = await ctx.db.get(doc.pageId);
    if (!page?.systemId) return;
    return { systemId: page.systemId };
  },
});

// ── Siembra de las columnas del tablero ────────────────────────────────────

/**
 * Deja las columnas del kanban de un sistema de tipo proyecto. No es una
 * migración por documento: es una siembra de tabla, y por eso va como mutación
 * interna. Reejecutarla no duplica, porque busca por (tipo, nombre) antes de
 * insertar, y corrige la etiqueta o la posición si el manifiesto cambió.
 */
export const sembrarColumnasDeProyecto = internalMutation({
  args: {},
  handler: async (ctx) => {
    let insertadas = 0;
    let corregidas = 0;
    for (const [position, column] of PROJECT_BOARD_COLUMNS.entries()) {
      const existing = await ctx.db
        .query('systemStatusDefinitions')
        .withIndex('by_type_status', (q) => q.eq('systemType', 'project').eq('statusName', column.id))
        .unique();
      if (!existing) {
        await ctx.db.insert('systemStatusDefinitions', {
          systemType: 'project',
          statusName: column.id,
          label: column.label,
          position,
        });
        insertadas += 1;
        continue;
      }
      if (existing.label !== column.label || existing.position !== position) {
        await ctx.db.patch(existing._id, { label: column.label, position });
        corregidas += 1;
      }
    }
    return { insertadas, corregidas };
  },
});

// ── El orden ───────────────────────────────────────────────────────────────

/**
 * Las nueve en serie, en el orden en que dependen unas de otras: la autoría
 * primero, el cierre después, y la siembra al final porque no toca documentos
 * de nadie.
 */
export const run = migrations.runner([
  internal.migrations.autoriaYPapelera.tasksAutoria,
  internal.migrations.autoriaYPapelera.pagesAutoria,
  internal.migrations.autoriaYPapelera.foldersAutoria,
  internal.migrations.autoriaYPapelera.systemsAutoria,
  internal.migrations.autoriaYPapelera.entitiesAutoria,
  internal.migrations.autoriaYPapelera.stickyNotesAutoriaYSistema,
  internal.migrations.autoriaYPapelera.tasksCierre,
  internal.migrations.autoriaYPapelera.pagesCierre,
  internal.migrations.autoriaYPapelera.pageSnapshotsSistema,
]);
