/*
 * Criterio: la página sin conexión sólo promete lo que se cumple. Lo que se
 * comparte sobrevive al cierre porque el service worker lo guarda; lo que se
 * hace en la app lo retiene la pestaña, y la página dice que cerrarla lo pierde.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OfflinePage from "./page";

describe("OfflinePage", () => {
  it("dice que lo compartido sube solo y que lo guardado en la pestaña se pierde si se cierra", () => {
    render(<OfflinePage />);

    expect(screen.getByText(/Se guarda en el teléfono y sube solo a Bandeja/)).toBeVisible();
    const promesa = screen.getByText(/^Lo que guardes /);
    expect(promesa).toHaveTextContent(/pestaña/);
    expect(promesa).toHaveTextContent(/Si la cierras antes, se pierde/);
  });
});
