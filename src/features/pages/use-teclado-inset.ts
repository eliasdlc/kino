import { useEffect, useState } from "react";

/**
 * Cuánto tapa el teclado del teléfono, en píxeles, medido desde el borde de
 * abajo del viewport de layout. Es lo que hay que subir algo `position: fixed`
 * para que quede justo encima del teclado y no debajo.
 *
 * El viewport de layout no encoge cuando sale el teclado (iOS, y Chrome desde
 * la 108); el visual sí. La diferencia entre los dos bordes de abajo es el
 * teclado. Se escucha también el `scroll` del viewport visual porque iOS lo
 * desplaza al seguir el cursor sin cambiar su alto.
 */
export function insetDelTeclado(
  alturaVentana: number,
  viewport: { height: number; offsetTop: number } | null,
): number {
  if (!viewport) return 0;
  return Math.max(0, Math.round(alturaVentana - (viewport.height + viewport.offsetTop)));
}

export function useTecladoInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => setInset(insetDelTeclado(window.innerHeight, vv));
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);

  return inset;
}
