/**
 * Criterio: el detalle es una hoja que se recoge al completar. "Marcar como
 * hecha" es su acción primaria: entrega la tarea a quien pinta la fila (que
 * la deja tachada debajo) y cierra la hoja; sin quien la tache, la hoja
 * completa por su cuenta. Una tarea hecha no ofrece completarla otra vez.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
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
});
