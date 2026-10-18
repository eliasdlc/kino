/**
 * Criterio: los últimos siete días se leen sin verlos y a simple vista. Cada
 * tira (completado y energía) lleva una frase con el valor de cada día, las
 * iniciales del día van en mute pleno a un tamaño legible, y sin datos la
 * sección lo dice con una frase en la voz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { WeeklyTrendsCard } from "./WeeklyTrendsCard";
import type { WeeklyTrend } from "@/features/energy/energy.types";

// Domingo 18 de octubre de 2026 al mediodía: la semana va del lunes 12 al domingo 18.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
});
afterEach(() => vi.useRealTimers());

const TRENDS = {
  snapshots: [
    { date: "2026-10-12", completionRate: 0.8 },
    { date: "2026-10-18", completionRate: 0.5 },
  ],
  checkins: [{ date: "2026-10-13", currentLevel: 72 }],
} as unknown as WeeklyTrend;

describe("WeeklyTrendsCard", () => {
  it("cuenta cada tira en una frase con el valor de cada día", () => {
    renderWithProviders(<WeeklyTrendsCard trends={TRENDS} />);
    const completado = screen.getByRole("img", { name: /^Tasa de completado de los últimos 7 días/ });
    expect(completado).toHaveAccessibleName(expect.stringContaining("lunes 80 %"));
    expect(completado).toHaveAccessibleName(expect.stringContaining("martes sin datos"));
    expect(completado).toHaveAccessibleName(expect.stringContaining("domingo 50 %"));
    const energia = screen.getByRole("img", { name: /^Energía registrada en los últimos 7 días/ });
    expect(energia).toHaveAccessibleName(expect.stringContaining("martes 72 de 100"));
    expect(energia).toHaveAccessibleName(expect.stringContaining("lunes sin check-in"));
  });

  it("pinta las iniciales en mute pleno y a un tamaño legible", () => {
    const { container } = renderWithProviders(<WeeklyTrendsCard trends={TRENDS} />);
    const iniciales = container.querySelectorAll('[data-slot="weekday"]');
    expect(iniciales).toHaveLength(7);
    expect(Array.from(iniciales).map((i) => i.textContent).join("")).toBe("LMXJVSD");
    iniciales.forEach((i) => {
      expect(i).toHaveClass("text-muted-foreground", "text-[0.74rem]");
      expect(i.className).not.toMatch(/\/60|text-\[0\.6rem\]/);
    });
  });

  it("sin datos lo dice con una frase en la voz", () => {
    renderWithProviders(<WeeklyTrendsCard trends={{ snapshots: [], checkins: [] } as unknown as WeeklyTrend} />);
    const vacio = screen.getByText(/La semana se dibuja aquí/);
    expect(vacio).toHaveClass("font-voice", "italic");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
