/**
 * Criterio: la fila del plan tiene dos niveles y el color acompaña a la
 * palabra. Una tarea vencida dice "vencida" antes de la fecha; una crítica se
 * distingue por el peso del título, no por un icono ni un color; la energía y
 * la duración van en texto a la derecha.
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
    ...over,
  } as unknown as TaskTransport;
}

const nada = { onComplete: vi.fn(), onMoveToTomorrow: vi.fn(), onRemove: vi.fn(), onStartTimer: vi.fn() };

describe("PlanTaskRow", () => {
  it("una vencida crítica lleva la palabra, la fecha, el peso y la energía en texto", () => {
    renderWithProviders(<PlanTaskRow task={tarea({})} {...nada} />);
    expect(screen.getByText("vencida")).toHaveClass("text-task-overdue");
    expect(screen.getByText(/1 ene/)).toBeInTheDocument();
    expect(screen.getByText(/teorema de Green/)).toHaveClass("font-semibold", "line-clamp-2");
    expect(screen.getByText("alta · 2:30")).toBeVisible();
    expect(document.querySelector("svg.text-red-400")).toBeNull();
  });

  it("una hecha se tacha y pierde sus acciones", () => {
    renderWithProviders(<PlanTaskRow task={tarea({ status: "done", dueDate: null, priority: "medium" })} {...nada} />);
    expect(screen.getByText(/teorema de Green/)).toHaveClass("line-through");
    expect(screen.queryByRole("button", { name: "Iniciar timer" })).toBeNull();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeVisible();
  });
});
