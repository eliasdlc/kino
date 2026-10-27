/**
 * Dónde cae un menú anclado al cursor (el de la barra `/` y el de las menciones
 * `@`), medido contra el viewport visual y no contra la ventana.
 *
 * En un teléfono con el teclado abierto `window.innerHeight` sigue midiendo la
 * pantalla entera: un menú que se abre "debajo del cursor si cabe" acababa
 * debajo del teclado, justo donde no se ve. El viewport visual sí encoge con el
 * teclado, así que el espacio de abajo se cuenta hasta su borde, y si no cabe el
 * menú sube encima de la línea. También se queda dentro del ancho: a 393 px un
 * menú de 16rem abierto cerca del margen derecho se salía de la pantalla.
 */

export interface Viewport {
  /** Desplazamiento del viewport visual respecto al de layout (iOS lo mueve). */
  offsetTop: number;
  height: number;
  width: number;
}

/** Aire entre el menú y la línea, y entre el menú y el borde de la pantalla. */
const AIRE = 6;
const BORDE = 8;

export function viewportVisual(): Viewport {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (vv) return { offsetTop: vv.offsetTop, height: vv.height, width: vv.width };
  return { offsetTop: 0, height: window.innerHeight, width: window.innerWidth };
}

/**
 * La posición fija del menú. `rect` es la caja del cursor en coordenadas de
 * ventana; el resultado también, listo para `position: fixed`.
 */
export function posicionJuntoAlCursor(
  rect: Pick<DOMRect, "top" | "bottom" | "left">,
  menu: { width: number; height: number },
  viewport: Viewport,
): { top: number; left: number } {
  const bordeInferior = viewport.offsetTop + viewport.height;
  const caben = bordeInferior - rect.bottom >= menu.height + AIRE + BORDE;
  const top = caben ? rect.bottom + AIRE : rect.top - menu.height - AIRE;
  const maxLeft = viewport.width - menu.width - BORDE;
  return {
    top: Math.round(Math.max(viewport.offsetTop + BORDE, top)),
    left: Math.round(Math.max(BORDE, Math.min(rect.left, maxLeft))),
  };
}

/** Coloca `el` junto al cursor. La capa es la de los overlays de la casa. */
export function colocarJuntoAlCursor(el: HTMLElement, rect: DOMRect) {
  const { top, left } = posicionJuntoAlCursor(
    rect,
    { width: el.offsetWidth || 256, height: el.offsetHeight || 300 },
    viewportVisual(),
  );
  el.style.position = "fixed";
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.zIndex = "var(--z-overlay)";
}
