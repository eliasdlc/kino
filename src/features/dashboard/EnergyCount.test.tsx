/**
 * Criterio: la cifra de la cota cuenta de 0 al valor en 550 ms y aterriza en
 * la cifra exacta sin mover lo que tiene al lado: la reserva de ancho lleva la
 * cifra final desde el primer pintado. Con movimiento reducido la cifra sale
 * ya puesta, porque esa cuenta la hace JavaScript y el CSS no la alcanza.
 */
import { describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { setReducedMotion } from "@/shared/testing/media";
import { EnergyCount } from "./EnergyCount";

const capa = (container: HTMLElement, slot: string) => container.querySelector<HTMLElement>(`[data-slot=${slot}]`);

describe("EnergyCount", () => {
  it("con el movimiento apagado la cifra sale ya puesta, sin contar desde cero", () => {
    setReducedMotion(true);
    const { container } = renderWithProviders(<EnergyCount value={82} />);
    expect(capa(container, "cota-cifra")).toHaveTextContent("82");
    // El CSS enseña la reserva y esconde la cuenta antes de que hidrate nada.
    expect(capa(container, "cota-reserva")).toHaveClass("motion-reduce:visible");
    expect(capa(container, "cota-cifra")).toHaveClass("motion-reduce:invisible");
    expect(capa(container, "cota")).toHaveClass("font-display", "text-primary", "tabular-nums");
  });

  it("la reserva de ancho lleva la cifra final, en el flujo, mientras los dígitos cuentan encima", async () => {
    setReducedMotion(false);
    const fotogramas: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => fotogramas.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      const { container } = renderWithProviders(<EnergyCount value={82} />);
      const reserva = capa(container, "cota-reserva");
      expect(reserva).toHaveTextContent("82");
      expect(reserva).toHaveClass("invisible");
      expect(reserva).not.toHaveClass("absolute");
      expect(capa(container, "cota-cifra")).toHaveClass("absolute");

      await act(async () => void fotogramas.shift()?.(performance.now() + 275));
      expect(Number(capa(container, "cota-cifra")?.textContent)).toBeLessThan(82);
      expect(reserva).toHaveTextContent("82");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("con el movimiento encendido cuenta y aterriza en la misma cifra a los 550 ms", async () => {
    setReducedMotion(false);
    const fotogramas: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => fotogramas.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      const { container } = renderWithProviders(<EnergyCount value={82} />);
      const arranque = performance.now();
      const cifra = () => Number(capa(container, "cota-cifra")?.textContent);

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
