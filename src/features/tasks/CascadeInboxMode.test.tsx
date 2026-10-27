/**
 * Criterio: repasar una a una es una hoja en el teléfono, con los destinos en
 * renglones de 48 px y sin pistas de teclado ([H], [M]) que el pulgar no usa;
 * la tarea se dice en palabras (sistema y meta), nunca con su estado crudo.
 * Elegir un destino mueve esa tarea.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { renderMobile, makeTestConvexClient, stubQuery } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { CascadeInboxMode } from "./CascadeInboxMode";

const tarea = { id: "t1", title: "Pagar el dominio", status: "backlog", priority: "medium", effectivePriority: "medium", energyLevel: "low", dueDate: null, estimatedTime: null, taskType: "task", systemId: "s1" } as unknown as TaskTransport;

describe("CascadeInboxMode", () => {
  it("en el teléfono enseña destinos con nombre, sin teclas ni estado crudo", () => {
    const convex = makeTestConvexClient([stubQuery(api.systems.list, [{ id: "s1", name: "Casa y salud" }] as never)]);
    renderMobile(<CascadeInboxMode tasks={[tarea]} open onOpenChange={vi.fn()} />, { convex });
    expect(screen.getByText("Casa y salud")).toBeInTheDocument();
    expect(screen.queryByText("backlog")).toBeNull();
    expect(screen.queryByText("H")).toBeNull();
    const hoy = screen.getByRole("button", { name: "Para hoy" });
    expect(hoy).toHaveClass("min-h-[3.2rem]");
    fireEvent.click(hoy);
    expect(convex.calls.find((c) => c.name === "tasks:bulkMove")?.args).toMatchObject({ taskIds: ["t1"], status: "today" });
  });

  it("D6: cada apertura empieza por la primera tarea de la selección de ese momento", () => {
    const otra = { ...tarea, id: "t2", title: "Renovar el seguro" } as TaskTransport;
    const tercera = { ...tarea, id: "t3", title: "Llamar al banco" } as TaskTransport;
    const convex = makeTestConvexClient([stubQuery(api.systems.list, [])]);
    const { rerender } = renderMobile(<CascadeInboxMode tasks={[tarea, otra]} open onOpenChange={vi.fn()} />, { convex });
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(screen.getByText("2 de 2")).toBeInTheDocument();

    rerender(<CascadeInboxMode tasks={[]} open={false} onOpenChange={vi.fn()} />);
    rerender(<CascadeInboxMode tasks={[tercera, tarea, otra]} open onOpenChange={vi.fn()} />);

    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Llamar al banco")).toBeInTheDocument();
  });

  it("D6: sin nada que enseñar, las teclas no hacen nada", () => {
    const onOpenChange = vi.fn();
    const convex = makeTestConvexClient([stubQuery(api.systems.list, [])]);
    renderMobile(<CascadeInboxMode tasks={[]} open onOpenChange={onOpenChange} />, { convex });
    fireEvent.keyDown(document.body, { key: "n" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
