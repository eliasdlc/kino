/**
 * Criterio: la curva del día es CSS y se puede leer sin verla. La barra de la
 * hora actual queda marcada (y es la única), cada barra lleva su altura como
 * transform y no como height, la figura cuenta en una frase el pico, lo
 * previsto a esta hora y los registros, y quien la ve lee las 6, las 12 y las
 * 18 bajo su columna.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { EnergyChart, curveSummary } from "./EnergyChart";

const DATA = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  predicted: hour === 10 ? 88 : 40,
  actual: hour === 9 ? 72 : null,
}));

describe("EnergyChart", () => {
  it("marca la hora actual una sola vez y escala cada barra con transform", () => {
    const { container } = renderWithProviders(<EnergyChart data={DATA} peak={{ start: 9, end: 12 }} currentHour={15} />);
    expect(container.querySelectorAll("[data-hour]")).toHaveLength(24);
    const ahora = container.querySelectorAll("[data-now]");
    expect(ahora).toHaveLength(1);
    expect(ahora[0]).toHaveAttribute("data-hour", "15");
    const pico = container.querySelector<HTMLElement>('[data-hour="10"]');
    expect(pico).toHaveAttribute("data-peak");
    expect(pico?.style.transform).toBe("scaleY(0.88)");
    expect(pico?.style.height).toBe("");
    expect(container.querySelector("[data-actual='72']")).toBeInTheDocument();
    for (const el of container.querySelectorAll<HTMLElement>("*")) {
      expect(el.style.animation).toBe("");
      expect([...el.classList].some((c) => c.startsWith("animate-") || c.startsWith("anim-"))).toBe(false);
    }
  });

  it("cuenta la curva en una frase: pico, lo previsto ahora y los registros", () => {
    renderWithProviders(<EnergyChart data={DATA} peak={{ start: 9, end: 12 }} currentHour={15} />);
    const figura = screen.getByRole("img");
    expect(figura).toHaveAccessibleName(curveSummary(DATA, { start: 9, end: 12 }, 15));
    expect(figura.getAttribute("aria-label")).toMatch(/Pico previsto de 9 AM a 12 PM/);
    expect(figura.getAttribute("aria-label")).toMatch(/A las 3 PM se prevén 40/);
    expect(figura.getAttribute("aria-label")).toMatch(/1 registro: 72 a las 9 AM/);
  });

  it("rotula las 6, las 12 y las 18 bajo su columna, fuera del nombre accesible", () => {
    const { container } = renderWithProviders(<EnergyChart data={DATA} peak={{ start: 9, end: 12 }} currentHour={15} />);
    const horas = container.querySelector<HTMLElement>("[data-slot=curve-hours]");
    expect(horas).toHaveAttribute("aria-hidden", "true");
    expect(horas).toHaveClass("text-muted-foreground", "tabular-nums");
    const rotulos = [...(horas?.children ?? [])] as HTMLElement[];
    expect(rotulos.map((r) => r.textContent)).toEqual(["6", "12", "18"]);
    expect(rotulos.map((r) => r.style.gridColumnStart)).toEqual(["7", "13", "19"]);
  });
});
