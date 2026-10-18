/**
 * Criterio: completar desde Hoy es un toque que tacha la fila en su sitio. La
 * fila hecha no salta ni desaparece hasta la siguiente visita, un aviso de
 * cuatro segundos ofrece Deshacer, y deshacer la devuelve a pendiente en la
 * misma posición.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import type { TaskTransport } from "@/features/tasks/tasks.types";

const toastMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), { error: vi.fn(), success: vi.fn() }),
}));

function tarea(id: string, title: string, over: Partial<TaskTransport> = {}): TaskTransport {
  return {
    id,
    title,
    status: "today",
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    estimatedTime: null,
    dueDate: null,
    taskType: "task",
    systemId: "s1",
    ...over,
  } as unknown as TaskTransport;
}

// El estado del servidor, que la mutación simulada cambia de verdad: así la
// fila tachada se prueba contra una lista en la que ya consta como hecha.
let tareas: TaskTransport[] = [];
const toggle = vi.fn(({ taskId }: { taskId: string }) => {
  tareas = tareas.map((t) => (t.id === taskId ? { ...t, status: t.status === "done" ? "today" : "done" } : t)) as TaskTransport[];
});

vi.mock("@/features/tasks/tasks.hooks", () => ({
  useTodayPlanTasks: () => ({ data: tareas, isLoading: false }),
  useToggleTodayTask: () => ({ mutate: toggle }),
  useMoveToTomorrow: () => ({ mutate: vi.fn() }),
  useRemoveFromPlan: () => ({ mutate: vi.fn() }),
}));

const { TodayPlanCard, UNDO_MS } = await import("./TodayPlanCard");

const titulos = () => screen.getAllByText(/Leer|Escribir/).map((el) => el.textContent);

describe("TodayPlanCard", () => {
  beforeEach(() => {
    toastMock.mockClear();
    toggle.mockClear();
    tareas = [tarea("a", "Leer el capítulo 3"), tarea("b", "Escribir el resumen")];
  });

  it("tacha la fila en su sitio con un Deshacer de cuatro segundos, y deshacer la devuelve", () => {
    const { rerender } = renderWithProviders(<TodayPlanCard noProfile={false} />);
    expect(titulos()).toEqual(["Leer el capítulo 3", "Escribir el resumen"]);

    fireEvent.click(screen.getAllByRole("button", { name: "Completar" })[0]!);
    rerender(<TodayPlanCard noProfile={false} />);

    // Sigue la primera, tachada, con su círculo en --ok.
    expect(titulos()).toEqual(["Leer el capítulo 3", "Escribir el resumen"]);
    expect(screen.getByText("Leer el capítulo 3")).toHaveClass("line-through");
    expect(screen.getByRole("button", { name: "Deshacer" }).firstElementChild?.className).toContain("bg-task-done");
    expect(screen.getByText(/1 hecha/)).toBeInTheDocument();
    expect(screen.queryByText(/hecha hoy$/)).toBeNull();

    expect(toastMock).toHaveBeenCalledTimes(1);
    const [mensaje, opciones] = toastMock.mock.calls[0] as [string, { duration: number; action: { label: string; onClick: () => void } }];
    expect(mensaje).toBe("Hecha: Leer el capítulo 3");
    expect(opciones.duration).toBe(UNDO_MS);
    expect(UNDO_MS).toBe(4000);
    expect(opciones.action.label).toBe("Deshacer");

    opciones.action.onClick();
    rerender(<TodayPlanCard noProfile={false} />);
    expect(toggle).toHaveBeenCalledTimes(2);
    expect(titulos()).toEqual(["Leer el capítulo 3", "Escribir el resumen"]);
    expect(screen.getByText("Leer el capítulo 3")).not.toHaveClass("line-through");
    expect(screen.getAllByRole("button", { name: "Completar" })).toHaveLength(2);
  });

  it("una hecha de una visita anterior no ocupa fila: sólo cuenta", () => {
    tareas = [tarea("a", "Leer el capítulo 3", { status: "done" }), tarea("b", "Escribir el resumen")];
    renderWithProviders(<TodayPlanCard noProfile={false} />);
    expect(titulos()).toEqual(["Escribir el resumen"]);
    expect(screen.getByText("1 hecha hoy")).toBeInTheDocument();
  });
});
