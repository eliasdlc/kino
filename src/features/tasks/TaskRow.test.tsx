/**
 * Criterio: una sola fila de tarea para todo el producto. En lista lleva el
 * sistema delante en la meta, vencida en coral y alta como peso, no color; en
 * el teléfono sus acciones salen en una hoja con su nombre (no un menú
 * flotante) y cada renglón ejecuta su operación; la compacta no tiene cola.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { renderMobile, renderWithProviders } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskRow } from "./TaskRow";

function tarea(over: Partial<TaskTransport> = {}): TaskTransport {
  return {
    id: "t1",
    title: "Preparar la presentación del proyecto final",
    status: "week",
    priority: "high",
    effectivePriority: "high",
    energyLevel: "low",
    estimatedTime: "01:15",
    dueDate: "2020-03-02T12:00:00.000Z",
    taskType: "task",
    systemId: "s1",
    ...over,
  } as unknown as TaskTransport;
}

describe("TaskRow", () => {
  it("en lista dice el sistema, vencida en coral y la prioridad alta como peso", () => {
    renderWithProviders(<TaskRow task={tarea()} context="Universidad" onComplete={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText("Universidad")).toBeInTheDocument();
    expect(screen.getByText("vencida")).toHaveClass("text-task-overdue");
    expect(screen.getByText("alta")).not.toHaveClass("text-task-overdue");
    expect(screen.getByText(/proyecto final/)).toHaveClass("font-semibold", "line-clamp-2");
    expect(screen.getByText("energía baja")).toBeVisible();
    expect(screen.getByText("1:15").closest("[data-slot=margin-row-trailing]")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Completar Preparar/ })).toHaveClass("size-[2.85rem]");
  });

  it("en el teléfono las acciones abren una hoja con renglones con nombre", () => {
    const papelera = vi.fn();
    renderMobile(
      <TaskRow
        task={tarea()}
        onComplete={vi.fn()}
        actions={[{ label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: papelera }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const renglon = screen.getByRole("button", { name: "Mover a la papelera" });
    expect(renglon).toHaveClass("min-h-[3.2rem]");
    fireEvent.click(renglon);
    expect(papelera).toHaveBeenCalledOnce();
  });

  it("la compacta no tiene cola y el título va en text-sm", () => {
    const { container } = renderWithProviders(<TaskRow task={tarea()} density="compacta" onComplete={vi.fn()} />);
    expect(container.querySelector("[data-slot=margin-row-trailing]")).toBeNull();
    expect(screen.getByText(/proyecto final/)).toHaveClass("text-sm", "line-clamp-3");
  });
});
