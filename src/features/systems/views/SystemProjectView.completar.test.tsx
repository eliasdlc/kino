/**
 * Criterio: completar desde la hoja de detalle, en la pestaña de planificación
 * de un sistema de proyecto, tacha la fila en su renglón en vez de hacerla
 * desaparecer. La hoja y la lista comparten la visita que monta el dueño
 * (`conVisita`); sin ella la hoja tacha en una visita y la lista no se entera.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { addDays, startOfToday } from "date-fns";
import { api } from "@convex/_generated/api";
import { makeSystem } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { setNavigation } from "@/shared/testing/navigation";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { SystemProjectView } from "./SystemProjectView";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(() => "aviso"), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn(), warning: vi.fn() }),
}));

const manana = addDays(startOfToday(), 1).toISOString();
const tarea = (id: string, title: string) =>
  ({
    id,
    title,
    status: "week",
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    dueDate: null,
    startDate: manana,
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

describe("SystemProjectView", () => {
  it("O3: completar desde la hoja en Planificación deja la fila tachada en su sitio", async () => {
    setNavigation({ pathname: "/systems/s1", search: "?view=planning" });
    const sistema = makeSystem({ id: "s1", name: "Proyecto", templateType: "project" } as never);
    const [informe, estudio] = [tarea("a", "Entregar el informe"), tarea("b", "Estudiar")];
    const convex = makeTestConvexClient([
      consulta([informe, estudio]),
      stubQuery(api.folders.bySystem, []),
      stubQuery(api.systems.list, []),
      stubQuery(api.sprints.bySystem, []),
    ]);
    const { container } = renderWithProviders(<SystemProjectView system={sistema} initialTasks={[informe, estudio]} />, { convex });

    fireEvent.click(await screen.findByRole("button", { name: "Abrir Entregar el informe" }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como hecha" }));
    act(() => convex.publish(consulta([{ ...informe, status: "done" }, estudio])));

    const titulos = [...container.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);
    expect(titulos).toContain("Entregar el informe");
    expect(container.querySelector("[data-struck]")).not.toBeNull();
  });
});
