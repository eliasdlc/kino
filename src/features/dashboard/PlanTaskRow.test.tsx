/**
 * Criterio: la fila del plan es una fila de margen y el color acompaña a la
 * palabra. El círculo de completar mide 48 px y vive en el margen; una tarea
 * vencida dice "vencida" antes de la fecha y es lo único en coral; una
 * crítica se distingue por el peso del título; la duración va en mute a la
 * derecha; una hecha se tacha con --ok y pierde sus acciones.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { PlanTaskRow } from "./PlanTaskRow";

function tarea(over: Partial<TaskTransport>): TaskTransport {
  return {
    id: "t1",
    title: "Terminar la demostración del teorema de Green",
    status: "today",
    priority: "critical",
    energyLevel: "high",
    estimatedTime: "02:30",
    dueDate: "2020-01-01T12:00:00.000Z",
    taskType: "task",
    systemId: "s1",
    // Lo que el servidor manda ya calculado: vencida, cuenta como crítica.
    effectivePriority: over.priority ?? "critical",
    ...over,
  } as unknown as TaskTransport;
}

const nada = { onComplete: vi.fn(), onMoveToTomorrow: vi.fn(), onRemove: vi.fn(), onStartTimer: vi.fn() };

describe("PlanTaskRow", () => {
  it("una vencida crítica lleva la palabra en coral, el peso, la energía en texto y la duración en la cola", () => {
    const { container } = renderWithProviders(<PlanTaskRow task={tarea({})} {...nada} />);
    expect(container.querySelector("[data-slot=margin-row]")?.className).toContain("grid-cols-[var(--margen)_1fr_auto]");
    const circulo = screen.getByRole("button", { name: "Completar" });
    expect(circulo.className).toContain("size-[2.85rem]");
    expect(circulo.closest("[data-slot=margin-row-margin]")).not.toBeNull();
    expect(screen.getByText("vencida")).toHaveClass("text-task-overdue");
    expect(screen.getByText(/1 ene/)).toBeInTheDocument();
    expect(screen.getByText(/teorema de Green/)).toHaveClass("font-bold", "line-clamp-2");
    expect(screen.getByText("crítica")).not.toHaveClass("text-task-overdue");
    expect(screen.getByText("energía alta")).toBeVisible();
    expect(screen.getByText("2:30").closest("[data-slot=margin-row-trailing]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Más acciones" })).toBeInTheDocument();
  });

  it("una hecha se tacha con --ok, se queda en su fila y pierde sus acciones", () => {
    const { container } = renderWithProviders(<PlanTaskRow task={tarea({ status: "done", dueDate: null, priority: "medium" })} struck {...nada} />);
    expect(screen.getByText(/teorema de Green/)).toHaveClass("line-through", "text-muted-foreground");
    const circulo = screen.getByRole("button", { name: "Deshacer" });
    expect(circulo).toHaveAttribute("aria-pressed", "true");
    expect(circulo.firstElementChild?.className).toContain("bg-task-done");
    expect(circulo.firstElementChild?.className).toContain("anim-tachar");
    expect(circulo.firstElementChild?.className).not.toContain("bg-primary");
    expect(container.querySelector("[data-struck]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Más acciones" })).toBeNull();
  });
});
