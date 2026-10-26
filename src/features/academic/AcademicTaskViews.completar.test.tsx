/**
 * Criterio: completar desde la hoja de detalle, dentro de las vistas de tareas
 * de un sistema académico, tacha la fila de la semana en su renglón en vez de
 * hacerla desaparecer. La hoja y la lista comparten la visita que monta el
 * dueño (`conVisita`); sin ella la hoja tacha en una visita y la lista no se entera.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { addDays, startOfToday } from "date-fns";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { AcademicTaskViews } from "./AcademicTaskViews";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(() => "aviso"), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn(), warning: vi.fn() }),
}));

const hace3 = addDays(startOfToday(), -3).toISOString();
const tarea = (id: string, title: string) =>
  ({
    id,
    title,
    status: "week",
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    dueDate: hace3,
    startDate: null,
    estimatedTime: null,
    taskType: "task",
    systemId: "s1",
    folderId: null,
    parentTaskId: null,
    metadata: null,
    description: null,
    sprintId: null,
    contextTagId: null,
    recurrenceRule: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    inTodayPlan: false,
  }) as unknown as TaskTransport;

const consulta = (xs: TaskTransport[]) => stubQuery(api.tasks.bySystem, xs);

describe("AcademicTaskViews", () => {
  it("O1: completar desde la hoja deja la fila de la semana tachada en su sitio", () => {
    setNavigation({ pathname: "/systems/s1", search: "" });
    const [informe, estudio] = [tarea("a", "Entregar el informe"), tarea("b", "Estudiar")];
    const convex = makeTestConvexClient([consulta([informe, estudio]), stubQuery(api.folders.bySystem, []), stubQuery(api.systems.list, [])]);
    const { container } = renderWithProviders(<AcademicTaskViews systemId="s1" initialTasks={[informe, estudio]} />, { convex });

    fireEvent.click(screen.getByRole("button", { name: "Abrir Entregar el informe" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como hecha" }));
    act(() => convex.publish(consulta([{ ...informe, status: "done" }, estudio])));

    const titulos = [...container.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);
    expect(titulos).toContain("Entregar el informe");
    expect(container.querySelector("[data-struck]")).not.toBeNull();
  });
});
