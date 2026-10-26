/**
 * Criterio: en la semana de un sistema académico una tarea vencida y crítica
 * dice su prioridad en español y en la voz de la fila ("crítica", nunca
 * CRITICAL), y sus acciones salen de un solo botón "Más acciones": la papelera
 * y las subtareas no son controles sueltos junto al título.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { addDays, startOfToday } from "date-fns";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskWeekFocusView } from "./TaskWeekFocusView";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

const critica = {
  id: "t1",
  title: "Entregar el proyecto final",
  status: "week",
  priority: "critical",
  effectivePriority: "critical",
  energyLevel: "high",
  dueDate: addDays(startOfToday(), -5).toISOString(),
  estimatedTime: null,
  taskType: "task",
  systemId: "s1",
  folderId: null,
  metadata: null,
} as unknown as TaskTransport;

describe("TaskWeekFocusView", () => {
  it("dice la prioridad en español y reúne las acciones en un solo botón", () => {
    const convex = makeTestConvexClient([
      stubQuery(api.tasks.bySystem, [critica]),
      stubQuery(api.folders.bySystem, []),
      stubQuery(api.systems.list, []),
    ]);
    const { container } = renderWithProviders(<TaskWeekFocusView systemId="s1" initialData={[critica]} />, { convex });

    const fila = container.querySelector("[data-slot=task-card]") as HTMLElement;
    expect(fila).toHaveTextContent("crítica");
    expect(fila).not.toHaveTextContent(/CRITICAL/i);
    expect(fila.querySelectorAll("button[aria-label='Más acciones']")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /papelera/i })).toBeNull();
  });
});
