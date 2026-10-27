"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

/**
 * Una sola escucha de `matchMedia` para todas las filas: una lista de 200
 * tareas que preguntara cada una por su cuenta abría 200 suscripciones al
 * mismo media query. Aquí se abre una con el primer suscriptor y se cierra con
 * el último.
 */
const oyentes = new Set<() => void>();
let lista: MediaQueryList | null = null;

function avisar() {
  for (const oyente of oyentes) oyente();
}

function subscribe(onChange: () => void) {
  oyentes.add(onChange);
  if (!lista) {
    lista = window.matchMedia(QUERY);
    lista.addEventListener("change", avisar);
  }
  return () => {
    oyentes.delete(onChange);
    if (oyentes.size === 0 && lista) {
      lista.removeEventListener("change", avisar);
      lista = null;
    }
  };
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** En el servidor y durante la hidratación no se sabe qué puntero hay. */
function getServerSnapshot() {
  return null;
}

/**
 * Si el puntero principal es el dedo. Decide qué camino toma mover una tarea
 * (la hoja con nombre o el arrastre) y cómo se abren las acciones de una fila
 * (una hoja o un menú): lo que importa es con qué se toca, no el ancho. Una
 * tableta de 1024 px se toca con el dedo y necesita la hoja; una ventana
 * estrecha de escritorio tiene ratón y puede arrastrar.
 *
 * Devuelve `null` mientras no se sabe (el servidor y la hidratación). Quien lo
 * usa pinta algo neutro en ese instante en vez de adivinar: adivinar
 * "escritorio" en un teléfono montaba el tablero un momento y empezaba a
 * descargar `@dnd-kit` aunque luego no se usara.
 */
export function usePunteroGrueso(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
