/**
 * Criterio: una lista tacha sin moverse. Al completar, la fila se tacha en su
 * renglón y se queda aunque la suscripción ya no la traiga (lo sugerido deja
 * de sugerir una hecha); el aviso ofrece Deshacer, y Deshacer devuelve la
 * tarea una sola vez aunque se pulse tarde, porque la mutación es un flip.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskRow } from "./TaskRow";
import { useListaTachable } from "./useTachar";

const toastMock = vi.fn<(...args: unknown[]) => string>(() => "aviso");
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

const tarea = (id: string, title: string, status = "week") =>
  ({ id, title, status, priority: "medium", effectivePriority: "medium", energyLevel: "medium", dueDate: null, estimatedTime: null, taskType: "task", systemId: "s1" }) as unknown as TaskTransport;

function Lista({ items, toggle }: { items: TaskTransport[]; toggle: (id: string) => void }) {
  const { filas, struck, handleToggle } = useListaTachable(items, toggle);
  return (
    <div>
      {filas.map((t) => (
        <TaskRow key={t.id} task={t} struck={struck.has(t.id)} onComplete={() => handleToggle(t)} />
      ))}
    </div>
  );
}

describe("useListaTachable", () => {
  beforeEach(() => toastMock.mockClear());

  it("la fila tachada se queda en su renglón aunque la suscripción la suelte", () => {
    const toggle = vi.fn();
    const items = [tarea("a", "Primera"), tarea("b", "Segunda"), tarea("c", "Tercera")];
    const { rerender, container } = renderWithProviders(<Lista items={items} toggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Completar Segunda" }));
    expect(toggle).toHaveBeenCalledWith("b");
    // El servidor ya no la sugiere: la lista nueva viene sin ella.
    rerender(<Lista items={[items[0]!, items[2]!]} toggle={toggle} />);
    const titulos = [...container.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);
    expect(titulos).toEqual(["Primera", "Segunda", "Tercera"]);
    expect(screen.getByRole("button", { name: "Completar Segunda" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("[data-struck]")).not.toBeNull();
  });

  it("el Deshacer del aviso devuelve la tarea una sola vez", () => {
    const toggle = vi.fn();
    renderWithProviders(<Lista items={[tarea("a", "Primera")]} toggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));
    const opciones = toastMock.mock.calls[0]![1] as { action: { label: string; onClick: () => void }; duration: number };
    expect(opciones.action.label).toBe("Deshacer");
    expect(opciones.duration).toBe(4000);
    opciones.action.onClick();
    opciones.action.onClick();
    expect(toggle.mock.calls).toEqual([["a"], ["a"]]);
  });
});
