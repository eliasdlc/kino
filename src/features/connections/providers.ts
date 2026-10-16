/**
 * El registro de las fuentes conectadas: qué entrega cada una y por dónde.
 *
 * La regla que lo sostiene vive en AGENTS.md ("Fuentes conectadas"): **una
 * fuente entrega capturas a Bandeja, nunca tareas**. Las dos excepciones,
 * GitHub y el aula virtual, escriben tareas porque cada item trae un id estable
 * y un hecho que no hay que interpretar. Una fuente nueva que quiera escribir
 * tareas necesita una decisión escrita, y el test de este fichero falla hasta
 * que esa decisión esté en la lista.
 *
 * El servidor lo lee para rechazar una captura de una fuente que no existe, y
 * Ajustes para no pintar una fuente que todavía no responde.
 */

/** `live` responde hoy; `planned` tiene ticket; `needs_hands` espera una consola. */
export type EstadoProveedor = "live" | "planned" | "needs_hands";

/**
 * Lo que la fuente deja en Kino. `contenido` es Drive: importa sistemas,
 * carpetas y páginas, y tampoco crea tareas.
 */
export type Entrega = "captura" | "tarea" | "contenido";

/** Cómo llega lo nuevo de la fuente. */
export type Refresco = "oauth_poll" | "feed" | "webhook" | "forward" | "push";

export interface Proveedor {
  id: string;
  estado: EstadoProveedor;
  entrega: Entrega;
  /** La clase de captura que produce, cuando entrega capturas. */
  clase?: "email" | "file" | "link" | "text";
  refresco: Refresco;
}

export const PROVEEDORES: readonly Proveedor[] = [
  // Las dos excepciones escritas: escriben tareas con su id de la fuente.
  { id: "github", estado: "live", entrega: "tarea", refresco: "oauth_poll" },
  { id: "pva", estado: "live", entrega: "tarea", refresco: "push" },
  // El correo, por reenvío para todos y por Gmail con OAuth (D-40).
  { id: "correo", estado: "needs_hands", entrega: "captura", clase: "email", refresco: "forward" },
  { id: "gmail", estado: "needs_hands", entrega: "captura", clase: "email", refresco: "oauth_poll" },
  { id: "drive", estado: "needs_hands", entrega: "contenido", refresco: "oauth_poll" },
];

/** El proveedor con ese id, o `undefined` si no está en el registro. */
export function proveedor(id: string): Proveedor | undefined {
  return PROVEEDORES.find((p) => p.id === id);
}

/** Si Ajustes puede ofrecer esta fuente: sólo las que responden hoy. */
export function enPantalla(id: string): boolean {
  return proveedor(id)?.estado === "live";
}
