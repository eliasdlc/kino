/**
 * Criterio: completar desde la hoja de detalle, en las vistas de sistema que
 * no le pasan quien tache, deja la fila tachada en su sitio (sigue en su
 * lista aunque ya conste hecha), con un Deshacer que devuelve la tarea a su
 * estado de antes una sola vez.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TasksList } from "./TasksList";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const toastMock = vi.fn<(...args: unknown[]) => string>(() => "aviso");
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const tarea = (id: string, title: string, over: Record<string, unknown> = {}) =>
  ({
    id, title, status: "backlog", priority: "medium", effectivePriority: "medium", energyLevel: "medium", dueDate: null,
    startDate: null, estimatedTime: null, taskType: "task", systemId: "s1", folderId: null, parentTaskId: null,
    metadata: null, description: null, sprintId: null, contextTagId: null, recurrenceRule: null, ...over,
  }) as unknown as TaskTransport;

const titulosDe = (r: HTMLElement) => [...r.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);

describe("completar desde la hoja de detalle", () => {
  it("D2: la fila queda tachada en su sitio y el Deshacer devuelve su estado una sola vez", () => {
    const a = tarea("a", "Leer el capítulo dos");
    const b = tarea("b", "Pedir la beca");
    const convex = makeTestConvexClient([
      stubQuery(api.tasks.bySystem, [a, b]),
      stubQuery(api.folders.bySystem, []),
      stubQuery(api.systems.list, []),
    ]);
    const { container } = renderWithProviders(<TasksList systemId="s1" initialData={[a, b]} visibleTabs={["backlog"]} />, { convex });

    fireEvent.click(screen.getByRole("button", { name: "Abrir Leer el capítulo dos" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como hecha" }));
    act(() => convex.publish(stubQuery(api.tasks.bySystem, [{ ...a, status: "done" }, b])));

    expect(titulosDe(container)).toEqual(["Leer el capítulo dos", "Pedir la beca"]);
    expect(screen.getByRole("button", { name: "Completar Leer el capítulo dos" })).toHaveAttribute("aria-pressed", "true");

    const aviso = toastMock.mock.calls.at(-1)![1] as { action: { label: string; onClick: () => void } };
    expect(aviso.action.label).toBe("Deshacer");
    act(() => aviso.action.onClick());
    act(() => aviso.action.onClick());
    expect(convex.calls.filter((c) => c.name === "tasks:update")).toEqual([
      expect.objectContaining({ args: { id: "a", status: "backlog" } }),
    ]);
  });
});
