import { Migrations } from '@convex-dev/migrations';
import { components, internal } from '../_generated/api';
import type { GenericDatabaseWriter } from 'convex/server';
import type { DataModel, Doc } from '../_generated/dataModel';

// ════════════════════════════════════════════════════════════════════════════
// Las tablas del rework
// ════════════════════════════════════════════════════════════════════════════
//
// Da forma final a las siete tablas nuevas y a los dos campos que las
// acompañan. Ninguna tiene todavía lector ni escritor de producto: nacen con
// su forma, sus índices, su retención escrita y sus tests, y las fases
// siguientes les ponen pantalla.
//
// ── Qué rellena ────────────────────────────────────────────────────────────
//
//   systemMembers            ← una fila de dueño (`role: 'owner'`) por sistema
//                              existente. Es la consulta de cada petición en
//                              cuanto haya sistemas compartidos, y sin la fila
//                              del dueño ese día nadie alcanzaría lo suyo.
//   systems.memberAgentsAllowed ← false. Los agentes de un miembro invitado no
//                              escriben en un sistema compartido salvo que el
//                              dueño lo permita a mano. El valor seguro es no.
//
// ── Retención de cada tabla, y quién la dispara ────────────────────────────
//
//   eventLog        30 días desde `occurredAt`. La poda por lotes de
//                   `convex/eventLog.ts`, disparada por el cron diario
//                   `event-log-prune`.
//   itemLinks       30 días desde `lastSeenAt`. Una arista que nadie ha vuelto
//                   a recorrer en un mes dejó de ser cierta. La podará el
//                   mismo cron cuando la fase que las escribe exista; hoy no
//                   hay escritor, así que no hay nada que podar.
//   systemMembers   No se poda. Es estado, no historia: una fila vive mientras
//                   la persona pertenezca al sistema, y la borra la mutación
//                   que la expulsa o el borrado del sistema.
//   systemInvites   No se poda. Una invitación caducada (`expiresAt`) deja de
//                   ser canjeable pero se queda: es el rastro de a quién se
//                   invitó. La borra el dueño al revocarla (`revokedAt`).
//   sessionDigests  No se poda. `surfacedAt` y `actedAt` son el criterio de
//                   muerte del diario, no una fecha de caducidad: un digest
//                   que nunca se enseñó sigue siendo material que el usuario
//                   no ha visto.
//   proposals       14 días desde que se crea (`expiresAt`). No las borra un
//                   cron: pasan a `expired` cuando alguien mira la bandeja,
//                   porque el usuario tiene derecho a ver qué se le propuso y
//                   se le pasó. Tope de veinte pendientes por usuario, en la
//                   mutación (`convex/proposals.ts`).
//   captures        48 horas sin confirmar (`expiresAt`), y se avisa antes de
//                   que caduque: lo que alguien compartió desde fuera no
//                   desaparece en silencio. El blob de `blobPath` se borra con
//                   la fila.
//
// ── Idempotencia ───────────────────────────────────────────────────────────
// Comprueba antes de escribir en los dos pasos, así que una segunda pasada no
// toca ningún documento y no crea una segunda fila de dueño para un sistema.
//
// ── Cómo se corre ──────────────────────────────────────────────────────────
//   npx convex run migrations/tablasDelRework:run

export const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Lo que hay que hacerle a un sistema: asegurar su fila de dueño y dejar
 * `memberAgentsAllowed` en el valor seguro. Fuera de `migrateOne` para poder
 * probarlo sin montar el componente.
 *
 * Devuelve el parche que el documento necesita, o `undefined` si ya estaba.
 */
export async function asegurarDuenoYAgentes(
  ctx: { db: GenericDatabaseWriter<DataModel> },
  doc: Doc<'systems'>,
): Promise<{ memberAgentsAllowed: boolean } | undefined> {
  const yaEsta = await ctx.db
    .query('systemMembers')
    .withIndex('by_system_user', (q) => q.eq('systemId', doc._id).eq('userId', doc.userId))
    .unique();
  if (!yaEsta) {
    await ctx.db.insert('systemMembers', {
      systemId: doc._id,
      userId: doc.userId,
      role: 'owner',
      createdAt: doc.createdAt,
    });
  }
  if (doc.memberAgentsAllowed === undefined) return { memberAgentsAllowed: false };
  return undefined;
}

/**
 * Una fila de dueño por sistema, y el valor seguro de `memberAgentsAllowed`.
 * Los dos salen del mismo documento, así que van en la misma pasada.
 */
export const duenoYAgentes = migrations.define({
  table: 'systems',
  migrateOne: (ctx, doc) => asegurarDuenoYAgentes(ctx, doc),
});

export const run = migrations.runner([internal.migrations.tablasDelRework.duenoYAgentes]);
