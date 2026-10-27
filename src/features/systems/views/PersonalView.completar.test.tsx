/**
 * Criterio: completar en un sistema personal es el gesto de Hoy. El toque
 * rellena el círculo y tacha la fila, que se queda en su renglón aunque el
 * servidor ya la cuente como hecha; un aviso de cuatro segundos ofrece
 * Deshacer, que la devuelve a pendiente una sola vez.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { makeSystem, makeTask, mid } from "@/app/system-design/mock-data";
import { renderMobile } from "@/shared/testing/render";
import type { TaskTransport } from "@/features/tasks/tasks.types";

const toastMock = vi.fn<(...args: unknown[]) => string>(() => "aviso-1");
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// El servidor simulado: la mutación cambia el estado de verdad, así la fila
// tachada se prueba contra una lista que ya la cuenta como hecha.
let tareas: TaskTransport[] = [];
const toggle = vi.fn((taskId: string) => {
  tareas = tareas.map((t) => (t.id === taskId ? { ...t, status: t.status === "done" ? "today" : "done" } : t)) as TaskTransport[];
});

// Reabrir (el Deshacer) viaja por `mutateAsync` y devuelve la tarea como queda.
const reabrir = vi.fn(async (taskId: string) => {
  toggle(taskId);
  return tareas.find((t) => t.id === taskId)!;
});

vi.mock("@/features/tasks/tasks.hooks", () => ({
  useTasks: () => ({ data: tareas }),
  useToggleTask: () => ({ mutate: toggle, mutateAsync: reabrir }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(async () => undefined) }),
}));
vi.mock("@/features/folders/folders.hooks", () => ({ useFolders: () => ({ data: [] }) }));
vi.mock("@/features/tasks/CreateTaskDialog", () => ({ CreateTaskDialog: () => null }));
vi.mock("@/features/tasks/TaskDetailSheet", () => ({ TaskDetailSheet: () => null }));

const { PersonalView } = await import("./PersonalView");

const CASA = makeSystem({ id: mid("sys-p"), name: "Casa", templateType: "personal" });

describe("PersonalView, completar", () => {
  beforeEach(() => {
    toastMock.mockClear();
    toggle.mockClear();
    reabrir.mockClear();
    tareas = [
      makeTask({ id: mid("a"), systemId: CASA.id, title: "Caminar", status: "today" }),
      makeTask({ id: mid("b"), systemId: CASA.id, title: "Regar las plantas", status: "today" }),
    ];
  });

  it("tacha la fila en su sitio y ofrece Deshacer, que la devuelve una sola vez", async () => {
    const { rerender } = renderMobile(<PersonalView system={CASA} initialTasks={tareas} />);

    fireEvent.click(screen.getByRole("button", { name: "Completar Caminar" }));
    rerender(<PersonalView system={CASA} initialTasks={tareas} />);

    const circulo = screen.getByRole("button", { name: "Completar Caminar" });
    expect(circulo).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Caminar" })).toHaveClass("line-through");
    // Sigue en su renglón, delante de la que no se tocó.
    const filas = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(filas[0]).toContain("Caminar");
    expect(filas[1]).toContain("Regar las plantas");

    const [mensaje, opciones] = toastMock.mock.calls[0] as [string, { duration: number; action: { label: string; onClick: () => void } }];
    expect(mensaje).toBe("Hecha: Caminar");
    expect(opciones.duration).toBe(4000);
    expect(opciones.action.label).toBe("Deshacer");

    await act(async () => {
      opciones.action.onClick();
      opciones.action.onClick();
    });
    expect(reabrir).toHaveBeenCalledTimes(1);
    rerender(<PersonalView system={CASA} initialTasks={tareas} />);
    expect(screen.getByRole("button", { name: "Completar Caminar" })).toHaveAttribute("aria-pressed", "false");
  });
});
