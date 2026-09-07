/**
 * Criterio: la fila de la lista tiene dos niveles y un solo chip. El título
 * envuelve a dos líneas, la meta lleva el sistema y la fecha con "vencida"
 * delante cuando lo está, y crítica es peso del título, no un badge. A la
 * derecha sólo va el estado.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeTestConvexClient } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskListRow } from "./TaskListRow";

const tarea = {
  id: "t1",
  title: "Terminar la demostración del teorema de Green",
  status: "backlog",
  priority: "critical",
  energyLevel: "high",
  dueDate: "2020-01-01T12:00:00.000Z",
  systemId: "s1",
} as unknown as TaskTransport;

const sistemas = new Map([["s1", { id: "s1", name: "Semestre actual", color: "blue" }]]);

describe("TaskListRow", () => {
  it("dos niveles, la palabra vencida, el peso en crítica y el estado como único chip", () => {
    renderWithProviders(
      <TaskListRow task={tarea} systemMap={sistemas} onToggle={vi.fn()} onOpen={vi.fn()} />,
      { convex: makeTestConvexClient() },
    );
    expect(screen.getByText(/teorema de Green/)).toHaveClass("line-clamp-2", "font-semibold");
    expect(screen.getByText("vencida")).toHaveClass("text-task-overdue");
    expect(screen.getByText("Semestre actual")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeVisible();
    expect(screen.queryByText("CRIT")).toBeNull();
  });
});
