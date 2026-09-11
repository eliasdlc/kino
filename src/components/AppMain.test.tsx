/**
 * Criterio: `<main>` reserva el chrome inferior leyendo la variable y no un
 * número. Es la única forma de reducir a un sí o un no lo que si no sólo ve el
 * pulgar de quien usa el teléfono: si alguien vuelve a escribir `pb-16`, la
 * barra flotante y el timer dejan de caber y nada falla hasta la captura.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppMain } from "./AppMain";

describe("AppMain", () => {
  it("reserva abajo con la variable del chrome, no con un número", () => {
    render(<AppMain>contenido</AppMain>);

    const main = screen.getByRole("main");
    expect(main.style.paddingBottom).toBe("var(--kino-bottom-chrome)");
    expect(main.className).not.toMatch(/\bpb-/);
  });
});
