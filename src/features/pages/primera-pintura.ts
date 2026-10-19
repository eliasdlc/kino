import { createContext, useContext } from "react";

/**
 * Lo que comparten la primera pintura del editor (la del servidor, sin Tiptap)
 * y el editor que la sustituye. Las dos pintan con estas mismas clases, así que
 * la fila del título, la reserva de la fila del codex y el arranque del texto
 * caen en el mismo píxel en las dos; y quien bajó leyendo mientras llegaba el
 * editor sigue en el mismo sitio cuando llega.
 *
 * Vive aparte para que el layout la importe sin traer el editor consigo.
 */

/** La fila del título: el campo a la izquierda y Más a la derecha, en el teléfono. */
export const FILA_DEL_TITULO = "flex items-start gap-2";

/** El título de un manuscrito es texto, no interfaz: Literata, como el cuerpo. */
export const LETRA_DEL_TITULO =
  "font-serif text-[1.76rem] leading-[1.2] font-semibold tracking-[-0.01em]";

/**
 * El cuerpo de un manuscrito: la letra del escritor y la partición de palabras.
 * La prosa va justificada (globals.css); sin partir palabras, una columna de
 * teléfono abre ríos entre ellas. Las dos pinturas la llevan, así que las
 * líneas se parten igual en las dos.
 */
export const CUERPO_DEL_ESCRITOR = "tiptap-writer hyphens-auto";

/**
 * La puerta del panel en el título: 2.85rem de alto, sólo bajo md. En un
 * manuscrito lleva su palabra («Capítulo», «Escena») delante de los tres puntos,
 * porque ahí viven el estado y la sesión y un «…» solo no se adivina.
 */
export const BOTON_MAS =
  "press -mr-2 -mt-1 flex h-[2.85rem] min-w-[2.85rem] shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-sm font-medium text-muted-foreground transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-secondary hover:text-foreground md:hidden";

/** El nombre de esa puerta: empieza por la palabra que se ve. */
export function nombreDelBotonMas(etiqueta: string | null): string {
  return etiqueta ? `${etiqueta}: sesión, estado y más` : "Más del documento";
}

/**
 * El alto de la fila del codex mientras llegan sus fichas: el de una ficha
 * (2.25rem), su canto de abajo (0.25rem) y su margen (1rem).
 */
export const RESERVA_CODEX = "h-[3.5rem]";

export type PrimeraPintura = {
  titulo: string;
  cuerpo: React.ReactNode;
  writer: boolean;
  /** La palabra de la puerta del panel («Capítulo»); null en un documento. */
  etiquetaMas: string | null;
  /** Cuántas fichas del codex tiene el capítulo, según el servidor. */
  fichasDelCodex: number;
  onOpenPanel: () => void;
  /** Apunta qué contenedor desplazaba la primera pintura y dónde quedó. */
  guardarScroll: (scroll: ScrollGuardado) => void;
  /** Lo devuelve una sola vez, al editor que arranca ahí. */
  tomarScroll: () => ScrollGuardado | null;
};

/**
 * El contenedor que desplaza el texto y su `scrollTop`. En el teléfono es el
 * `main` de la app; en escritorio, la columna del editor.
 */
export type ScrollGuardado = { contenedor: HTMLElement; top: number };

/** El antepasado más cercano que de verdad se desplaza, empezando por el propio nodo. */
export function contenedorConScroll(desde: HTMLElement | null): HTMLElement | null {
  let nodo = desde;
  while (nodo) {
    const { overflowY } = getComputedStyle(nodo);
    if ((overflowY === "auto" || overflowY === "scroll") && nodo.scrollTop > 0) return nodo;
    nodo = nodo.parentElement;
  }
  return null;
}

export const PrimeraPinturaContext = createContext<PrimeraPintura | null>(null);

export function usePrimeraPintura() {
  return useContext(PrimeraPinturaContext);
}
