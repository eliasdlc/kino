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
});
