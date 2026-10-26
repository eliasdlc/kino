/**
 * Criterio: un nodo del grafo del universo se abre igual sin puntero. Cada nodo
 * es un botón con nombre (la entidad y su tipo), y Enter o Espacio abren su
 * ficha como un clic. En el teléfono cada nodo ofrece un blanco de 48 px aunque
 * se dibuje con 10, porque lo que se toca es el nodo y no el círculo pintado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MOBILE_WIDTH, renderWithProviders } from "@/shared/testing/render";
import { GraphCanvas } from "./UniverseGraph";
import { layoutGraph, type GraphNode } from "./entities.graph";

const NODOS: GraphNode[] = [
  { id: "ada", name: "Ada Salazar", type: "character", mentionCount: 0, workIds: [] },
  { id: "puerto", name: "Puerto Ceniza", type: "location", mentionCount: 9, workIds: [] },
];

const LIENZO_ALTO = 448;

function pintar() {
  const onOpen = vi.fn();
  const layout = layoutGraph(NODOS, [{ id: "r1", from: "ada", to: "puerto", label: null }]);
  renderWithProviders(<GraphCanvas layout={layout} onOpen={onOpen} />);
  return { onOpen, layout };
}

describe("GraphCanvas, nodos", () => {
  beforeEach(() => {
    // jsdom no hace layout: el lienzo mide lo que mide en un iPhone 15.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: MOBILE_WIDTH, height: LIENZO_ALTO }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("Enter y Espacio sobre un nodo abren su entidad", async () => {
    const { onOpen } = pintar();
    const nodo = screen.getByRole("button", { name: "Ada Salazar, personaje" });

    nodo.focus();
    expect(nodo).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenLastCalledWith("ada");

    screen.getByRole("button", { name: "Puerto Ceniza, lugar" }).focus();
    await userEvent.keyboard(" ");
    expect(onOpen).toHaveBeenLastCalledWith("puerto");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("cada nodo lleva un blanco táctil de al menos 48 px en el teléfono", () => {
    const { layout } = pintar();
    // El viewBox es cuadrado y se ajusta al lado corto del lienzo.
    const pxPorUnidad = Math.min(MOBILE_WIDTH, LIENZO_ALTO) / layout.size;

    for (const nombre of ["Ada Salazar, personaje", "Puerto Ceniza, lugar"]) {
      const blanco = screen.getByRole("button", { name: nombre }).querySelector('[data-slot="graph-hit"]');
      expect(blanco).toBeInTheDocument();
      expect(blanco).toHaveAttribute("r");
      const diametroPx = 2 * Number(blanco!.getAttribute("r")) * pxPorUnidad;
      expect(diametroPx).toBeGreaterThanOrEqual(48);
    }
  });
});
