import type { Extensions } from "@tiptap/react";
import { SceneBreak } from "./scene-break.extension";
import { MangaPage, Panel } from "./manga.extension";
import { SCREENPLAY_NODES, ScreenplayKeys } from "./screenplay.extension";
import type { MediumManifest } from "@/shared/lib/mediums";

/**
 * Extensiones de medium para un editor de escritura.
 *
 * Los **nodos** se montan todos, sin importar el medium de la obra: el contenido
 * ya escrito se guarda como HTML y solo se reconstruye si su nodo existe en el
 * schema. Montarlos siempre significa que cambiar el medium de una obra (o abrir
 * un capítulo pegado desde otra) nunca degrada estructura. Lo que sí depende del
 * medium es lo que el editor *ofrece*: el slash menu (`mediumSlashItems`), la
 * plantilla, el placeholder y el teclado del guion.
 */
export function mediumExtensions(medium: MediumManifest | null): Extensions {
  if (!medium) return [];
  return [
    SceneBreak,
    MangaPage,
    Panel,
    ...SCREENPLAY_NODES,
    ...(medium.screenplayKeys ? [ScreenplayKeys] : []),
  ];
}
