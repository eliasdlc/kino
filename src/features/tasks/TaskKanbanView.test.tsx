/**
 * Criterio: con el dedo el tablero de Acción no se arrastra, y lo decide el
 * puntero, no el ancho: un teléfono y una tableta táctil ancha reciben las
 * mismas secciones con título, y mover es la operación con nombre "Mover a
 * otra columna", que escribe el mismo cambio que el arrastre de escritorio. El
 * tablero con `@dnd-kit` no se monta. Completar tacha la fila en su columna.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { renderMobile, renderWithProviders, makeTestConvexClient, stubQuery } from "@/shared/testing/render";
import { conDedo } from "./puntero.testing";
import type { TaskTransport } from "./tasks.types";
import { TaskKanbanView } from "./TaskKanbanView";

const tareas = [
  { id: "t1", title: "Escribir la introducción", status: "today", energyLevel: "high", priority: "medium", effectivePriority: "medium", dueDate: null, estimatedTime: null, taskType: "task", systemId: "s1", folderId: null },
  { id: "t2", title: "Ordenar la bibliografía", status: "week", energyLevel: "low", priority: "medium", effectivePriority: "medium", dueDate: null, estimatedTime: null, taskType: "task", systemId: "s1", folderId: null },
] as unknown as TaskTransport[];

function pintar(render = renderMobile) {
  const convex = makeTestConvexClient([
    stubQuery(api.tasks.bySystem, tareas),
    stubQuery(api.folders.bySystem, []),
  ]);
  render(<TaskKanbanView systemId="s1" initialData={tareas} />, { convex });
  return convex;
}

describe("TaskKanbanView con el dedo", () => {
  it("agrupa en secciones y mueve con una hoja, sin el tablero de arrastre", () => {
    conDedo();
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

  it("en una tableta táctil ancha también da las secciones y la hoja, no el tablero", () => {
    conDedo();
    pintar(renderWithProviders);

    expect(screen.getByRole("heading", { name: "Energía alta" })).toBeInTheDocument();
    expect(screen.queryByText("Abriendo el tablero")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Más acciones" })[0]!);
    expect(screen.getByRole("button", { name: "Mover a otra columna" })).toBeInTheDocument();
  });

  it("completar deja la fila tachada en su columna, con el Deshacer", () => {
    conDedo();
    const convex = pintar();

    fireEvent.click(screen.getByRole("button", { name: "Completar Escribir la introducción" }));
    expect(convex.calls.some((c) => c.name === "tasks:toggle")).toBe(true);
    // La suscripción trae la tarea hecha en el mismo toque (es optimista).
    act(() => convex.publish(stubQuery(api.tasks.bySystem, [{ ...tareas[0]!, status: "done" }, tareas[1]!])));

    const circulo = screen.getByRole("button", { name: "Completar Escribir la introducción" });
    expect(circulo).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Energía alta" })).toBeInTheDocument();
  });
});
