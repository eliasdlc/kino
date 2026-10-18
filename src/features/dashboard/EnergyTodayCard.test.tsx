/**
 * Criterio: la cota que se abre todos los días no tiene ninguna animación en
 * bucle, usa el tramo que dice el servidor, pone la palabra que la explica
 * como h1 de la pantalla y enlaza la fecha al calendario con un blanco de
 * 48 px; y la cifra acaba siendo la misma con el movimiento encendido y
 * apagado, porque la cuenta la hace JavaScript y el CSS no la alcanza.
 */

import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { setReducedMotion } from "@/shared/testing/media";
import type { TodayCheckinRowTransport } from "@/features/energy/energy.types";
import { getCurrentSlot } from "./energyDisplay";

vi.mock("@/features/energy/energy.hooks", () => ({
  useTodayCheckins: () => ({ data: undefined }),
  useCreateCheckin: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCheckinAccuracy: () => ({ mutate: vi.fn(), isPending: false }),
  useEnergyBudget: () => null,
}));

const { EnergyTodayCard } = await import("./EnergyTodayCard");

const CURVA = Array.from({ length: 24 }, () => 55);

const CHECKIN = {
  id: "k17checkin0000000000000000000001",
  // El slot de ahora: la tarjeta abre en el tramo en curso, y un check-in de
  // otro tramo la dejaría en el estado vacío.
  slot: getCurrentSlot(),
  currentLevel: 82,
  sleepQuality: null,
  predictionAccuracy: null,
  createdAt: new Date().toISOString(),
} as unknown as TodayCheckinRowTransport;

function pintar() {
  return renderWithProviders(
    <EnergyTodayCard clock={{ hour: new Date().getHours(), date: "2026-09-11", timezone: "America/Santo_Domingo" }} initialCheckins={[CHECKIN]} projectedCurve={CURVA} chronotype="intermediate" />,
  );
}

describe("EnergyTodayCard", () => {
  it("usa el tramo del servidor aunque el dispositivo tenga otra hora", () => {
    setReducedMotion(true);
    const hour = (new Date().getHours() + 12) % 24;
    renderWithProviders(
      <EnergyTodayCard clock={{ hour, date: "2026-09-11", timezone: "America/Santo_Domingo" }}
        initialCheckins={[{ ...CHECKIN, slot: getCurrentSlot(hour), currentLevel: 73 }]}
        projectedCurve={CURVA} chronotype="intermediate" />,
    );
    expect(screen.getByText("73")).toBeVisible();
    const fecha = screen.getByRole("link", { name: /viernes, 11 de septiembre/i });
    expect(fecha).toHaveAttribute("href", "/calendar");
    expect(fecha.className).toContain("min-h-[2.85rem]");
  });

  it("la palabra de la cota es el h1 de la pantalla y la frase va en la voz", () => {
    setReducedMotion(true);
    pintar();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Ahora, energía alta.");
    expect(h1).toHaveClass("font-display");
    expect(screen.getByText("Buen momento para lo más exigente.")).toHaveClass("font-voice", "italic");
    expect(screen.getByRole("radiogroup", { name: "Tramo del día" })).toBeInTheDocument();
  });

  it("no deja ninguna animación en bucle, ni por clase ni en un style inline", () => {
    const { container } = pintar();

    for (const el of container.querySelectorAll<HTMLElement>("*")) {
      expect([...el.classList].filter((c) => c.includes("infinite"))).toEqual([]);
      expect(el.style.animation).not.toContain("infinite");
    }
  });

  it("con el movimiento apagado la cifra sale ya puesta, sin contar desde cero", () => {
    setReducedMotion(true);
    pintar();

    expect(screen.getByText("82")).toBeVisible();
  });

  it("con el movimiento encendido cuenta, y aterriza en la misma cifra", async () => {
    setReducedMotion(false);

    // Los fotogramas se sirven a mano en vez de esperar a los de jsdom, que
    // llegan cuando el proceso puede y no cuando toca: con la suite entera en
    // paralelo la espera fallaba por hambre de CPU y no por la cuenta. La
    // cuenta interpola por tiempo transcurrido, así que darle su marca de
    // tiempo prueba lo mismo y además deja mirar por dónde va a mitad de
    // camino, que antes no se podía.
    const fotogramas: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => fotogramas.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});

    try {
      const { container } = pintar();
      const arranque = performance.now();

      // A mitad de la cuenta va por el camino: ni en cero ni en la cifra final.
      await act(async () => void fotogramas.shift()?.(arranque + 275));
      const enCamino = Number(container.querySelector("[data-slot=cota]")?.textContent);
      expect(enCamino).toBeGreaterThan(0);
      expect(enCamino).toBeLessThan(82);

      // Pasados los 550ms aterriza, y se queda ahí.
      await act(async () => void fotogramas.shift()?.(arranque + 600));
      expect(screen.getByText("82")).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
