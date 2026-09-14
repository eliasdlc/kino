/**
 * Criterio: la hoja enseña todas las columnas, la actual no se puede elegir, y
 * elegir otra devuelve su id una sola vez. Que la columna actual esté presente
 * y deshabilitada, en vez de ausente, es la decisión: una lista que cambia de
 * largo según dónde esté la tarjeta hay que releerla entera cada vez.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, renderMobile } from "@/shared/testing/render";
import { PROJECT_BOARD_COLUMNS } from "@/shared/lib/system-types";
import { BoardMoveSheet } from "./BoardMoveSheet";

function pintar(onMove = vi.fn(), pintador = renderWithProviders) {
  pintador(
    <BoardMoveSheet
      open
      onOpenChange={() => {}}
      subject="Diagrama ER de la tesis"
      destinations={PROJECT_BOARD_COLUMNS}
      currentId="in_progress"
      onMove={onMove}
    />,
  );
  return onMove;
}

describe("BoardMoveSheet", () => {
  it("lista las cuatro columnas del tablero y dice qué se está moviendo", () => {
    pintar();

    for (const columna of PROJECT_BOARD_COLUMNS) {
      expect(screen.getByRole("button", { name: new RegExp(columna.label) })).toBeVisible();
    }
    expect(screen.getByText("Diagrama ER de la tesis")).toBeVisible();
  });

  it("la columna actual se ve, se marca y no se puede pulsar", () => {
    pintar();

    const actual = screen.getByRole("button", { name: /En progreso/ });
    expect(actual).toBeDisabled();
    expect(actual).toHaveTextContent("aquí");
  });

  it("elegir otra columna devuelve su id una sola vez", async () => {
    const onMove = pintar();

    await userEvent.click(screen.getByRole("button", { name: /En review/ }));

    expect(onMove).toHaveBeenCalledExactlyOnceWith("review");
  });

  it("en el teléfono es la misma hoja, como drawer", async () => {
    const onMove = pintar(vi.fn(), renderMobile);

    expect(screen.getByRole("button", { name: /En progreso/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Hecho/ }));

    expect(onMove).toHaveBeenCalledExactlyOnceWith("done");
  });
});
