/**
 * Criterio: las lecturas del codex son pestañas-palabra enlazadas por URL; la
 * elegida se anuncia con `aria-selected` y se pinta en tinta, no en ámbar, y
 * cada pestaña lleva a su `?view=`.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { CodexNav } from "./CodexNav";

describe("CodexNav", () => {
  it("la lectura actual va seleccionada y en tinta, las otras enlazan a su vista", () => {
    renderWithProviders(<CodexNav systemId="s1" current="grafo" />);

    const grafo = screen.getByRole("tab", { name: "Grafo" });
    expect(grafo).toHaveAttribute("aria-selected", "true");
    expect(grafo).toHaveClass("text-foreground");
    expect(grafo).not.toHaveClass("bg-primary");
    expect(screen.getByRole("tab", { name: "Biblioteca" })).toHaveAttribute("href", "/systems/s1/codex?view=biblioteca");
  });
});
