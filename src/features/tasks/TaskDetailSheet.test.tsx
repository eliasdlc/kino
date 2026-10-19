/**
 * Criterio: el detalle es una hoja que se recoge al completar. "Marcar como
 * hecha" es su acción primaria: entrega la tarea a quien pinta la fila (que
 * la deja tachada debajo) y cierra la hoja; sin quien la tache, la hoja
 * completa por su cuenta. Una tarea hecha no ofrece completarla otra vez.
 * Cada dato es un renglón de margen con su rótulo; la fecha va en español; la
 * hoja no se vacía mientras se recoge y lo escrito se guarda al cerrar.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders, makeTestConvexClient } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskDetailSheet } from "./TaskDetailSheet";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }) }));

const tarea = {
  id: "t1", title: "Reescribir la apertura", description: null, status: "today", priority: "high", effectivePriority: "high",
  energyLevel: "high", dueDate: null, startDate: null, estimatedTime: null, taskType: "task", systemId: "s1", folderId: null,
  sprintId: null, contextTagId: null, recurrenceRule: null, metadata: null, completedBy: null, completedVia: null,
} as unknown as TaskTransport;

describe("TaskDetailSheet", () => {
  it("completar entrega la tarea a la lista y recoge la hoja", () => {
    const onComplete = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<TaskDetailSheet task={tarea} systemId="s1" open onOpenChange={onOpenChange} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar como hecha" }));
    expect(onComplete).toHaveBeenCalledWith(tarea);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sin quien tache la fila, la hoja completa por su cuenta", () => {
    const convex = makeTestConvexClient();
    renderWithProviders(<TaskDetailSheet task={tarea} systemId="s1" open onOpenChange={vi.fn()} />, { convex });
    fireEvent.click(screen.getByRole("button", { name: "Marcar como hecha" }));
    expect(convex.calls.find((c) => c.name === "tasks:toggle")?.args).toMatchObject({ id: "t1" });
  });

  it("una hecha no ofrece completarla", () => {
    renderWithProviders(<TaskDetailSheet task={{ ...tarea, status: "done" }} systemId="s1" open onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Marcar como hecha" })).toBeNull();
  });

  it("cada dato lleva su rótulo en el margen, y la fecha en español", () => {
    renderWithProviders(
      <TaskDetailSheet task={{ ...tarea, dueDate: "2026-10-18T05:00:00.000Z" }} systemId="s1" open onOpenChange={vi.fn()} />,
    );
    const prioridad = screen.getByRole("group", { name: "Prioridad" });
    const renglon = prioridad.closest("[data-slot=detail-row]") as HTMLElement;
    expect(within(renglon).getByText("Prioridad").closest("[data-slot=margin-row-margin]")).not.toBeNull();
    expect(within(prioridad).getByRole("button", { name: "Alta" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/18 oct 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Oct 18/)).toBeNull();
  });

  it("mientras se recoge, la hoja sigue enseñando la tarea", () => {
    const { rerender } = renderWithProviders(<TaskDetailSheet task={tarea} systemId="s1" open onOpenChange={vi.fn()} />);
    rerender(<TaskDetailSheet task={null} systemId="" open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("Título")).toHaveValue("Reescribir la apertura");
  });

  it("lo escrito se guarda al cerrar, aunque no haya pasado el autoguardado", () => {
    const convex = makeTestConvexClient();
    const { rerender } = renderWithProviders(<TaskDetailSheet task={tarea} systemId="s1" open onOpenChange={vi.fn()} />, { convex });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Reescribir la apertura sin el clima" } });
    rerender(<TaskDetailSheet task={null} systemId="" open={false} onOpenChange={vi.fn()} />);
    expect(convex.calls.find((c) => c.name === "tasks:update")?.args).toMatchObject({ id: "t1" });
  });
});
