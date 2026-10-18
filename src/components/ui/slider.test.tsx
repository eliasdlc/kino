/**
 * Criterio: el deslizador es táctil en toda su pista, no sólo en el pulgar:
 * el Root horizontal mide al menos 2.85rem de alto y el pulgar amplía su
 * zona de toque a esa misma medida. El pulgar lleva el foco único y no
 * transiciona nada que no sea color o transform.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { Slider } from "./slider";

describe("Slider", () => {
  it("la pista mide 2.85rem y el pulgar amplía su toque a la misma medida", () => {
    renderWithProviders(<Slider aria-label="Horas" defaultValue={[8]} max={24} />);
    const pulgar = screen.getByRole("slider");
    expect(pulgar.className).toContain("after:-inset-[0.925rem]");
    expect(pulgar.className).toContain("focus-ring");
    expect(pulgar.className).not.toContain("ring-3");
    const raiz = pulgar.closest("[data-slot=slider]");
    expect(raiz?.className).toContain("data-horizontal:min-h-[2.85rem]");
  });
});
