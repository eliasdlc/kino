/**
 * Qué se prueba: que la barra del presupuesto pone la cifra delante y nunca a
 * Kino de sujeto. En sobregiro es donde más tienta escribir que el producto
 * hace algo ("Kino no te frena"), y es justo el estado en el que la persona
 * necesita el número, no una voz.
 */

import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import type { EnergyBudget } from "./energy.budget";

const budget = vi.hoisted(() => ({ current: null as EnergyBudget | null }));
vi.mock("./energy.hooks", () => ({ useEnergyBudget: () => budget.current }));

const { EnergyBudgetBar } = await import("./EnergyBudgetBar");

function conBudget(partial: Partial<EnergyBudget>): void {
  budget.current = { state: "ok", committed: 0, spent: 0, pending: 0, limit: 20, pct: 0, spentPct: 0, remaining: 20, overBy: 0, ...partial };
}

describe("EnergyBudgetBar", () => {
  it("en sobregiro el texto empieza por la cifra y el sujeto de la frase es el día", () => {
    conBudget({ state: "over", committed: 27, limit: 20, pct: 135, spentPct: 60, remaining: 0, overBy: 7 });
    renderWithProviders(<EnergyBudgetBar />);

    const texto = screen.getByText(/sobregiro/i).textContent ?? "";
    expect(texto).toMatch(/^Sobregiro de 7 pts/);
    expect(texto).not.toMatch(/\bKino\b/);
    expect(texto).toMatch(/el día ya está sobrevendido/);
  });

  it("con margen dice cuántos puntos quedan, y la cifra va antes que la palabra", () => {
    conBudget({ committed: 8, limit: 20, pct: 40, spentPct: 20, remaining: 12 });
    renderWithProviders(<EnergyBudgetBar />);

    expect(screen.getByText("Quedan 12 pts para hoy.")).toBeVisible();
  });

  it("sin presupuesto no pinta nada, en vez de una barra vacía que no significa nada", () => {
    budget.current = null;
    const { container } = renderWithProviders(<EnergyBudgetBar />);
    expect(container).toBeEmptyDOMElement();
  });
});
