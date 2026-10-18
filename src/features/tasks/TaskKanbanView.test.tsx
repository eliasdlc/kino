/**
 * Criterio: en el teléfono el tablero de Acción no se arrastra. Las columnas
 * son secciones con título y las tareas son filas; mover es la operación con
 * nombre "Mover a otra columna", que abre una hoja con las columnas y escribe
 * el mismo cambio que el arrastre de escritorio. El tablero con `@dnd-kit` no
 * se monta.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { renderMobile, makeTestConvexClient, stubQuery } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskKanbanView } from "./TaskKanbanView";

const tareas = [
  { id: "t1", title: "Escribir la introducción", status: "today", energyLevel: "high", priority: "medium", effectivePriority: "medium", dueDate: null, estimatedTime: null, taskType: "task", systemId: "s1", folderId: null },
  { id: "t2", title: "Ordenar la bibliografía", status: "week", energyLevel: "low", priority: "medium", effectivePriority: "medium", dueDate: null, estimatedTime: null, taskType: "task", systemId: "s1", folderId: null },
] as unknown as TaskTransport[];

describe("TaskKanbanView en el teléfono", () => {
  it("agrupa en secciones y mueve con una hoja, sin el tablero de arrastre", () => {
    const convex = makeTestConvexClient([
      stubQuery(api.tasks.bySystem, tareas),
      stubQuery(api.folders.bySystem, []),
    ]);
    renderMobile(<TaskKanbanView systemId="s1" initialData={tareas} />, { convex });

    expect(screen.getByRole("heading", { name: "Energía alta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Energía baja" })).toBeInTheDocument();
    expect(screen.queryByText("Abriendo el tablero")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Más acciones" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Mover a otra columna" }));
    fireEvent.click(screen.getByRole("button", { name: /Energía baja/ }));

    const update = convex.calls.find((c) => c.name === "tasks:update");
    expect(update?.args).toMatchObject({ id: "t1", energyLevel: "low" });
  });
});
