/**
 * Criterio: la cifra de la cota cuenta de 0 al valor en 550 ms y aterriza en
 * la cifra exacta; con movimiento reducido sale ya puesta, porque esa cuenta
 * la hace JavaScript y el bloque de CSS no la alcanza.
 */
import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { setReducedMotion } from "@/shared/testing/media";
import { EnergyCount } from "./EnergyCount";

describe("EnergyCount", () => {
  it("con el movimiento apagado la cifra sale ya puesta, sin contar desde cero", () => {
    setReducedMotion(true);
    renderWithProviders(<EnergyCount value={82} />);
    expect(screen.getByText("82")).toBeVisible();
    expect(screen.getByText("82")).toHaveClass("font-display", "text-primary", "tabular-nums");
  });

  it("con el movimiento encendido cuenta y aterriza en la misma cifra a los 550 ms", async () => {
    setReducedMotion(false);
    const fotogramas: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => fotogramas.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      const { container } = renderWithProviders(<EnergyCount value={82} />);
      const arranque = performance.now();
      const cifra = () => Number(container.querySelector("[data-slot=cota]")?.textContent);

      await act(async () => void fotogramas.shift()?.(arranque + 275));
      expect(cifra()).toBeGreaterThan(0);
      expect(cifra()).toBeLessThan(82);

      await act(async () => void fotogramas.shift()?.(arranque + 600));
      expect(cifra()).toBe(82);
      expect(fotogramas).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
