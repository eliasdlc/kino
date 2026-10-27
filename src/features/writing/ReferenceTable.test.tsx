/**
 * Criterio: la mesa de referencias se usa con un dedo. Cada referencia fijada
 * es una fila con su nombre y su tipo, y Quitar dice qué ficha quita sin
 * esconderse detrás de un hover; Fijar abre la búsqueda del codex y cada
 * resultado fija la ficha que nombra.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { ReferenceTable } from "./ReferenceTable";

const ENTIDADES = [
  { id: "e1", name: "Aurelia Voss", type: "character", coverImageUrl: null },
  { id: "e2", name: "Puerto Ceniza", type: "location", coverImageUrl: null },
];

function montar(pinnedIds: string[], onToggle = vi.fn()) {
  const convex = makeTestConvexClient([stubQuery(api.entities.bySystem, ENTIDADES as never)]);
  renderWithProviders(
    <ReferenceTable systemId="s1" pinnedIds={pinnedIds} onToggle={onToggle} canPin />,
    { convex },
  );
  return onToggle;
}

describe("ReferenceTable", () => {
  it("la referencia fijada lee nombre y tipo, y Quitar nombra la ficha sin esperar al hover", async () => {
    const onToggle = montar(["e1"]);
    expect(await screen.findByText("Aurelia Voss")).toBeVisible();
    expect(screen.getByText("personaje")).toBeVisible();

    const quitar = screen.getByRole("button", { name: "Quitar Aurelia Voss de la mesa" });
    expect(quitar).toHaveClass("size-[2.85rem]");
    expect(quitar.className).not.toMatch(/(^|\s)opacity-0/);
    await userEvent.click(quitar);
    expect(onToggle).toHaveBeenCalledWith("e1");
  });

  it("Fijar abre la búsqueda y cada resultado fija la ficha que nombra", async () => {
    const onToggle = montar(["e1"]);
    const fijar = await screen.findByRole("button", { name: "Fijar una referencia" });
    expect(fijar).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(fijar);

    expect(screen.getByRole("textbox", { name: "Buscar en el codex" })).toHaveFocus();
    // La ya fijada no se ofrece otra vez.
    expect(screen.queryByRole("button", { name: "Fijar Aurelia Voss" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fijar Puerto Ceniza" }));
    expect(onToggle).toHaveBeenCalledWith("e2");
  });
});
