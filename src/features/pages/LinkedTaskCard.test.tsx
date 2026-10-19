/**
 * Criterio: una tarea enlazada se lee en español y con los roles de la casa.
 * La fecha lleva su estado delante («vencida 8 sept», «vence hoy»), el coral
 * sólo acompaña a vencida, hecha es `--ok`, y desvincular dice qué tarea quita.
 * La estimación, que llega como reloj, se lee en minutos u horas.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { LinkedTaskCard, duracionEstimada, fechaDeEntrega } from "./LinkedTaskCard";
import type { LinkedTaskTransport } from "./pages.types";

const tarea = {
  id: "t1",
  title: "Repasar el capítulo 2",
  status: "today",
  priority: "high",
  taskType: null,
  dueDate: "2026-09-08T12:00:00",
  estimatedTime: null,
} as unknown as LinkedTaskTransport;

const hoy = new Date("2026-10-18T12:00:00");

describe("fechaDeEntrega", () => {
  it("una fecha pasada dice vencida con el día, y sólo esa va en coral", () => {
    expect(fechaDeEntrega("2026-09-08T12:00:00", hoy)).toEqual({ texto: "vencida 8 sept", vencida: true });
    expect(fechaDeEntrega("2026-10-18T12:00:00", hoy)).toEqual({ texto: "vence hoy", vencida: false });
    expect(fechaDeEntrega("2026-10-19T12:00:00", hoy)).toEqual({ texto: "vence mañana", vencida: false });
  });
});

describe("duracionEstimada", () => {
  it("lee el reloj en minutos u horas", () => {
    expect(duracionEstimada("00:25:00")).toBe("25 min");
    expect(duracionEstimada("01:30:00")).toBe("1 h 30 min");
    expect(duracionEstimada("2:00")).toBe("2 h");
    expect(duracionEstimada(null)).toBeNull();
  });
});

describe("LinkedTaskCard", () => {
  it("lee la meta en español, con la prioridad alta en peso", () => {
    renderWithProviders(<LinkedTaskCard task={tarea} onToggle={vi.fn()} onEdit={vi.fn()} onUnlink={vi.fn()} />);
    expect(screen.getByText(/hoy/)).toBeVisible();
    expect(screen.getByText("alta")).toHaveClass("font-semibold");
    expect(screen.getByText(/^vencida/)).toHaveClass("text-warn");
  });

  it("completar y desvincular dicen qué tarea tocan", () => {
    renderWithProviders(<LinkedTaskCard task={tarea} onToggle={vi.fn()} onEdit={vi.fn()} onUnlink={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Completar «Repasar el capítulo 2»" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Desvincular «Repasar el capítulo 2»" })).toBeInTheDocument();
  });

  it("hecha va en --ok y tachada, sin fecha ni coral", () => {
    renderWithProviders(
      <LinkedTaskCard task={{ ...tarea, status: "done" }} onToggle={vi.fn()} onEdit={vi.fn()} onUnlink={vi.fn()} />,
    );
    expect(screen.getByText("Repasar el capítulo 2")).toHaveClass("line-through");
    expect(screen.queryByText(/vencida/)).not.toBeInTheDocument();
  });
});
