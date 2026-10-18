/*
 * Criterio: sin red, la pastilla lo dice como papel con hairline (sin
 * desenfoque, sin borde blanco, sin sombra) y desaparece con la red. Y el
 * reintento de la pantalla offline no recarga a ciegas: sin red lo dice, y
 * con red vuelve a pedir la pantalla que falló.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderMobile } from "@/shared/testing/render";
import { OfflineIndicator } from "./OfflineIndicator";
import { Reintentar } from "./Reintentar";

function conRed(online: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(online);
}

afterEach(() => vi.restoreAllMocks());

describe("OfflineIndicator", () => {
  it("sin red aparece como papel, sin vidrio ni sombra", () => {
    conRed(false);
    renderMobile(<OfflineIndicator />);

    const pastilla = screen.getByText("Sin conexión").parentElement!;
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(pastilla).toHaveClass("bg-background", "border-border");
    expect(pastilla.className).not.toMatch(/backdrop-blur|border-white|shadow/);
  });

  it("con red no hay nada que decir", () => {
    conRed(true);
    renderMobile(<OfflineIndicator />);

    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
  });
});

describe("Reintentar", () => {
  it("sin red no recarga: dice que todavía no la hay", async () => {
    conRed(false);
    renderMobile(<Reintentar />);

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByRole("status")).toHaveTextContent("Todavía no hay red");
  });

  it("con red recarga la pantalla que falló", async () => {
    conRed(true);
    const recargar = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload: recargar });
    renderMobile(<Reintentar />);

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(recargar).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
