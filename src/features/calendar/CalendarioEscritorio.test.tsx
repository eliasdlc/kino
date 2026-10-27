/**
 * Criterio: en la rejilla de escritorio hoy se marca con su fecha en tinta,
 * subrayada, y no tiñendo de ámbar la columna entera ni su celda de todo el
 * día. El ámbar es para la acción primaria y el estado activo, no un fondo; los
 * numerales de los demás días van en gris. Las horas de la columna izquierda
 * se leen enteras (08:00), sin partirse, en gris y tabulares.
 */
import { screen } from "@testing-library/react";
import { format, startOfToday, startOfWeek } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { CalendarioEscritorio } from "./CalendarioEscritorio";

function pintar() {
  const hoy = startOfToday();
  return renderWithProviders(
    <CalendarioEscritorio
      datos={{ byDayAllDay: new Map(), timedByDay: new Map(), unscheduledTasks: [], sugerencia: () => null }}
      weekStart={startOfWeek(hoy, { weekStartsOn: 1 })}
      onWeekStart={vi.fn()}
      selectedDay={hoy}
      onSelectDay={vi.fn()}
      projectedCurve={[]}
      onUpdate={vi.fn()}
      onProgramar={vi.fn()}
      onOpenTask={vi.fn()}
      onAcceptSuggestion={vi.fn()}
    />,
  );
}

describe("CalendarioEscritorio", () => {
  it("hoy lleva su fecha en tinta y ninguna columna lleva lavado ámbar", () => {
    const { container } = pintar();

    const cabeceraDeHoy = screen.getAllByRole("button").find((b) => b.getAttribute("aria-current") === "date")!;
    const numeral = [...cabeceraDeHoy.querySelectorAll("span")].find((s) => s.textContent === format(startOfToday(), "d"))!;
    expect(numeral).toHaveClass("text-foreground", "underline");
    expect(numeral).not.toHaveClass("text-primary");
    expect(container.querySelector('[class*="bg-primary/5"]')).toBeNull();
  });

  it("las etiquetas de hora se leen 08:00 de una pieza, en mute y tabulares, sin partirse", () => {
    pintar();

    const etiquetas = [...document.querySelectorAll('[data-slot="hora"]')];
    expect(etiquetas.length).toBeGreaterThan(0);
    expect(etiquetas[0]).toHaveTextContent(/^\d{2}:\d{2}$/);
    const fila = etiquetas[0]!.parentElement!;
    expect(fila).toHaveClass("text-muted-foreground", "tabular-nums", "whitespace-nowrap");
    expect(fila).not.toHaveClass("text-xs");
  });
});
