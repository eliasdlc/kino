/**
 * Contrato del versionado de capítulos (KIN-142), sin nada de servidor.
 *
 * Vive aparte de `writing.snapshots.ts` porque el panel de historial es un
 * componente de cliente: importar el servicio le arrastraría drizzle y el driver
 * de Postgres al bundle.
 */

/**
 * Cuántas versiones se conservan por capítulo. Un snapshot por sesión de una
 * novela larga crece rápido y el free tier de Neon tiene techo; junto al dedupe
 * (no se guarda si el texto no cambió) esto es lo que mantiene el coste plano.
 */
export const MAX_SNAPSHOTS_PER_PAGE = 15;

export interface SnapshotListItem {
  id: string;
  wordCount: number;
  /** Diferencia de palabras contra la versión anterior. */
  wordsDelta: number;
  createdAt: string;
  sessionStartedAt: string | null;
}

export interface SnapshotDetail extends SnapshotListItem {
  pageId: string;
  content: string | null;
}

/**
 * Añade el delta de palabras de cada versión contra la anterior. La lista llega
 * de la más nueva a la más vieja, así que "la anterior" es la siguiente del
 * array — el sitio donde es fácil equivocarse de signo.
 */
export function withDeltas(
  rows: Array<Omit<SnapshotListItem, "wordsDelta">>,
): SnapshotListItem[] {
  return rows.map((row, i) => ({
    ...row,
    wordsDelta: row.wordCount - (rows[i + 1]?.wordCount ?? 0),
  }));
}
