import { describe, expect, it } from "vitest";
import { setReducedMotion } from "@/shared/testing/media";
import { scrollBehavior } from "./motion";

/**
 * Criterio: un desplazamiento lanzado desde JavaScript no anima cuando el
 * sistema pide movimiento reducido. Es el único sitio donde eso se decide, y
 * se prueba aquí porque el bloque global de `globals.css` no alcanza a
 * `scrollIntoView`: si esta función devolviera siempre `smooth`, nada más en
 * la batería se pondría rojo.
 */
describe("scrollBehavior", () => {
  it("anima cuando el sistema no pide lo contrario", () => {
    expect(scrollBehavior()).toBe("smooth");
  });

  it("no anima con prefers-reduced-motion", () => {
    setReducedMotion(true);
    expect(scrollBehavior()).toBe("auto");
  });
});
