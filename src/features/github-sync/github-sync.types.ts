/**
 * KIN-135 · Sincronización de issues de GitHub con el board de un sistema `project`.
 *
 * Dirección: **sólo lectura, GitHub manda**. Es una decisión, no una etapa: la
 * bidireccional obliga a resolver conflictos de escritura y a pelearse con el
 * rate limit de la API, y el valor del feature no está en escribir en GitHub:
 * está en meter los issues al motor de energía de Kino.
 */

/** Nombre del proveedor tal y como se guarda en `tasks.external_source`. */
export const GITHUB_SOURCE = "github";

/** Lo que se persiste en `systems.metadata.github`. */
export interface GithubRepoRef {
  owner: string;
  repo: string;
}

/** Issue de GitHub, recortado a lo que esta integración usa. */
export interface GithubIssue {
  /** Id numérico global, único en todo GitHub. Es el que va a `external_id`. */
  id: number;
  /** Número visible dentro del repositorio (#42). Sólo para mostrar. */
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  htmlUrl: string;
  milestone: GithubMilestone | null;
}

export interface GithubMilestone {
  id: number;
  title: string;
  description: string | null;
  dueOn: string | null;
  state: "open" | "closed";
}

/** Resultado de una sincronización, para que la UI diga algo concreto. */
export interface SyncResult {
  imported: number;
  updated: number;
  unchanged: number;
  sprintsCreated: number;
  /**
   * true si se alcanzó el tope de páginas. El free tier corta las funciones a
   * 10s, así que es preferible sincronizar de más a menos que quedarse a medias
   * sin avisar.
   */
  truncated: boolean;
  syncedAt: string;
}

/** Estado de la conexión, tal y como lo consume la pantalla de ajustes. */
export interface GithubConnectionStatus {
  connected: boolean;
  /** Login de GitHub de la cuenta conectada; null si no hay conexión. */
  login: string | null;
  lastSyncedAt: string | null;
  /**
   * true cuando hay conexión guardada pero GitHub ya no acepta el token
   * (revocado o caducado). La UI pide reconectar en vez de romperse.
   */
  revoked: boolean;
}

/** Error de la API de GitHub que quien llama puede distinguir y degradar. */
export class GithubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** true si el token dejó de valer: hay que reconectar, no reintentar. */
    readonly unauthorized: boolean,
  ) {
    super(message);
    this.name = "GithubApiError";
  }
}
