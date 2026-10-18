/**
 * Criterio: el menú de la barra y el de las menciones se abren donde se ven.
 * Con el teclado abierto el espacio de abajo se cuenta hasta el borde del
 * viewport visual, no hasta el de la ventana, así que el menú sube encima de
 * la línea en vez de esconderse detrás del teclado; y nunca se sale de lado.
 */
import { describe, expect, it } from "vitest";
import { posicionJuntoAlCursor } from "./caret-popover";

const menu = { width: 256, height: 300 };
const telefonoSinTeclado = { offsetTop: 0, height: 852, width: 393 };
// El mismo teléfono con el teclado ocupando 340 px de abajo.
const telefonoConTeclado = { offsetTop: 0, height: 512, width: 393 };

describe("posicionJuntoAlCursor", () => {
  it("abre debajo de la línea cuando cabe", () => {
    const pos = posicionJuntoAlCursor({ top: 180, bottom: 200, left: 40 }, menu, telefonoSinTeclado);
    expect(pos.top).toBe(206);
  });

  it("con el teclado abierto sube encima de la línea en vez de quedar debajo del teclado", () => {
    // En la ventana entera cabría (852 - 330 = 522 px libres), pero el
    // viewport visual termina en 512.
    const pos = posicionJuntoAlCursor({ top: 310, bottom: 330, left: 40 }, menu, telefonoConTeclado);
    expect(pos.top).toBe(8);
    expect(pos.top + menu.height).toBeLessThanOrEqual(310);
  });

  it("no se sale por la derecha cuando el cursor está cerca del borde", () => {
    const pos = posicionJuntoAlCursor({ top: 100, bottom: 120, left: 300 }, menu, telefonoSinTeclado);
    expect(pos.left + menu.width).toBeLessThanOrEqual(393 - 8);
  });

  it("nunca sube por encima del viewport visual desplazado", () => {
    const pos = posicionJuntoAlCursor(
      { top: 200, bottom: 220, left: 40 },
      menu,
      { offsetTop: 120, height: 300, width: 393 },
    );
    expect(pos.top).toBeGreaterThanOrEqual(128);
  });
});
