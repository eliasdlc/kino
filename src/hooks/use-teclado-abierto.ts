import { useEffect, useState } from "react";

/**
 * Cuánto tiene que encogerse el viewport visual para que sea el teclado y no
 * las barras del navegador apareciendo. Por debajo de esto es cromo del
 * navegador; por encima sólo cabe un teclado.
 */
const UMBRAL_TECLADO = 150;


/** Si el foco está en algo donde se escribe. */
function escribiendoEn(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const tipo = (el as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"].includes(tipo);
}

/**
 * Si el teclado del teléfono está tapando la parte de abajo de la pantalla.
 * Dos señales, porque ninguna sola llega siempre: el viewport visual que se
 * encoge más de lo que miden las barras del navegador, y el foco dentro de un
 * campo cuando el puntero es un dedo (en un escritorio estrecho el foco en un
 * campo no abre ningún teclado).
 */
export function useTecladoAbierto(): boolean {
  const [porViewport, setPorViewport] = useState(false);
  const [porFoco, setPorFoco] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const mirar = () => setPorViewport(window.innerHeight - viewport.height > UMBRAL_TECLADO);
    mirar();
    viewport.addEventListener("resize", mirar);
    return () => viewport.removeEventListener("resize", mirar);
  }, []);

  useEffect(() => {
    const dedo = window.matchMedia("(pointer: coarse)");
    const mirar = () => setPorFoco(dedo.matches && escribiendoEn(document.activeElement));
    document.addEventListener("focusin", mirar);
    document.addEventListener("focusout", mirar);
    return () => {
      document.removeEventListener("focusin", mirar);
      document.removeEventListener("focusout", mirar);
    };
  }, []);

  return porViewport || porFoco;
}
