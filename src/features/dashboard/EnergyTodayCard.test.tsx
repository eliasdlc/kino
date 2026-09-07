/**
 * Qué se prueba: que la tarjeta que se abre todos los días no tiene ninguna
 * animación en bucle, y que la cifra de energía acaba siendo la misma con el
 * movimiento encendido y apagado.
 *
 * Lo segundo importa porque esa cifra no la anima CSS sino JavaScript: una
 * cuenta de 0 hasta el valor. Un apagado que sólo tocara CSS la dejaría
 * contando, y quien pidió menos movimiento vería justo lo que pidió no ver.
 */

import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
    <EnergyTodayCard initialCheckins={[CHECKIN]} projectedCurve={CURVA} chronotype="intermediate" />,
  );
}

describe("EnergyTodayCard", () => {
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
    pintar();

    // La cuenta dura 550ms y jsdom sirve los fotogramas más lentos que un
    // navegador; el margen es para eso, no para esconder que no llegue.
    await waitFor(() => expect(screen.getByText("82")).toBeVisible(), { timeout: 3000 });
  });
});
