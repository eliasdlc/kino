/**
 * Criterio: la cota que se abre todos los días no tiene ninguna animación en
 * bucle, usa el tramo que dice el servidor, pone la palabra que la explica
 * como h1 de la pantalla y enlaza la fecha al calendario con un blanco de
 * 48 px que se ve como enlace; el tramo elegido en el segmento es el que el
 * botón registra; y la cifra acaba siendo la misma con el movimiento
 * encendido y apagado, porque la cuenta la hace JavaScript.
 */

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { setReducedMotion } from "@/shared/testing/media";
import type { TodayCheckinRowTransport } from "@/features/energy/energy.types";
import { getCurrentSlot } from "./energyDisplay";

const { crear } = vi.hoisted(() => ({ crear: vi.fn() }));

vi.mock("@/features/energy/energy.hooks", () => ({
  useTodayCheckins: () => ({ data: undefined }),
  useCreateCheckin: () => ({ mutate: crear, isPending: false }),
  useUpdateCheckinAccuracy: () => ({ mutate: vi.fn(), isPending: false }),
  useEnergyBudget: () => null,
}));

const { EnergyTodayCard } = await import("./EnergyTodayCard");

const CURVA = Array.from({ length: 24 }, () => 55);

/** La cifra que se ve, la capa que cuenta (la reserva de ancho va aparte). */
const cifra = (container: HTMLElement) => container.querySelector("[data-slot=cota-cifra]")?.textContent;

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
    const { container } = renderWithProviders(
      <EnergyTodayCard clock={{ hour, date: "2026-09-11", timezone: "America/Santo_Domingo" }}
        initialCheckins={[{ ...CHECKIN, slot: getCurrentSlot(hour), currentLevel: 73 }]}
        projectedCurve={CURVA} chronotype="intermediate" />,
    );
    expect(cifra(container)).toBe("73");
    const fecha = screen.getByRole("link", { name: /viernes, 11 de septiembre/i });
    expect(fecha).toHaveAttribute("href", "/calendar");
    expect(fecha.className).toContain("min-h-[2.85rem]");
    // Se lee como enlace y no como etiqueta: icono de calendario y chevron.
    expect(fecha.querySelector("[data-slot=fecha-icono]")).toHaveClass("size-[1.15em]");
    expect(fecha.querySelectorAll("svg")).toHaveLength(2);
    expect(fecha).toHaveClass("hover:text-foreground");
  });

  it("el tramo elegido es el que el botón registra: la etiqueta y lo guardado coinciden", () => {
    setReducedMotion(true);
    crear.mockClear();
    // A las 3 PM el tramo en curso es la tarde, y la tarde ya tiene check-in.
    renderWithProviders(
      <EnergyTodayCard clock={{ hour: 15, date: "2026-09-11", timezone: "America/Santo_Domingo" }}
        initialCheckins={[{ ...CHECKIN, slot: "afternoon" }]}
        projectedCurve={CURVA} chronotype="intermediate" />,
    );
    expect(screen.getByRole("button", { name: "Actualizar el check-in de la tarde" })).toBeInTheDocument();
    // La opción con registro lo dice como texto, no como aria-label de un span.
    expect(screen.getByRole("radio", { name: /Tarde, con check-in/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Mañana" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Mañana,/);
    fireEvent.click(screen.getByRole("button", { name: "Registrar energía de la mañana" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear.mock.calls[0]![0]).toMatchObject({ slot: "morning" });
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
    const { container } = pintar();

    expect(cifra(container)).toBe("82");
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
      const enCamino = Number(cifra(container));
      expect(enCamino).toBeGreaterThan(0);
      expect(enCamino).toBeLessThan(82);

      // Pasados los 550ms aterriza, y se queda ahí.
      await act(async () => void fotogramas.shift()?.(arranque + 600));
      expect(cifra(container)).toBe("82");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
