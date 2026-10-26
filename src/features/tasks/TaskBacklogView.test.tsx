/**
 * Criterio: completar en el Backlog no hace desaparecer la fila. La vista
 * filtra por estado y la suscripción trae la tarea hecha en el mismo toque
 * (es optimista); aun así la fila se queda tachada en su renglón, con un aviso
 * que ofrece Deshacer, y la cuenta de la sección baja. Mover a la papelera no
 * pregunta: el aviso trae su propio Deshacer.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubMutationPending, stubQuery } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskBacklogView } from "./TaskBacklogView";

const toastMock = vi.fn<(...args: unknown[]) => string>(() => "aviso");
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

const tarea = (id: string, title: string) =>
  ({
    id,
    title,
    status: "backlog",
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    dueDate: null,
    estimatedTime: null,
    taskType: "task",
    systemId: "s1",
    folderId: null,
    metadata: null,
    inTodayPlan: false,
  }) as unknown as TaskTransport;

const tareas = [tarea("a", "Leer el capítulo dos"), tarea("b", "Pedir la beca")];

function pintar() {
  const convex = makeTestConvexClient([
    stubQuery(api.tasks.bySystem, tareas),
    stubQuery(api.folders.bySystem, []),
    stubQuery(api.systems.list, []),
  ]);
  const vista = renderWithProviders(<TaskBacklogView systemId="s1" initialData={tareas} />, { convex });
  return { ...vista, convex };
}

describe("TaskBacklogView", () => {
  it("completar tacha la fila en su sitio y ofrece Deshacer", () => {
    const { convex, container } = pintar();

    fireEvent.click(screen.getByRole("button", { name: "Completar Leer el capítulo dos" }));
    act(() => convex.publish(stubQuery(api.tasks.bySystem, [{ ...tareas[0]!, status: "done" }, tareas[1]!])));

    const titulos = [...container.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);
    expect(titulos).toEqual(["Leer el capítulo dos", "Pedir la beca"]);
    expect(screen.getByRole("button", { name: "Completar Leer el capítulo dos" })).toHaveAttribute("aria-pressed", "true");
    expect(toastMock).toHaveBeenCalledWith("Hecha: Leer el capítulo dos", expect.objectContaining({ duration: 4000 }));
    expect(screen.getByRole("heading", { name: "Backlog" }).parentElement).toHaveTextContent("1");
  });

  it("E4: entre la reapertura y la escritura del estado guardado, la fila no sale del Backlog", async () => {
    const escritura = stubMutationPending(api.tasks.update);
    const convex = makeTestConvexClient(
      [stubQuery(api.tasks.bySystem, tareas), stubQuery(api.folders.bySystem, []), stubQuery(api.systems.list, [])],
      [stubMutation(api.tasks.toggle, { status: "today", completedBy: null, completedVia: null, observedMinutes: 0 }), escritura.stub],
    );
    const { container } = renderWithProviders(<TaskBacklogView systemId="s1" initialData={tareas} />, { convex });
    const titulos = () => [...container.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);
    const [lectura, beca] = [tareas[0]!, tareas[1]!];

    fireEvent.click(screen.getByRole("button", { name: "Completar Leer el capítulo dos" }));
    act(() => convex.publish(stubQuery(api.tasks.bySystem, [{ ...lectura, status: "done" }, beca])));
    const aviso = toastMock.mock.calls.at(-1)![1] as { action: { onClick: () => void } };
    await act(async () => aviso.action.onClick());
    await vi.waitFor(() => expect(convex.calls.map((c) => c.name)).toContain("tasks:update"));
    // El servidor ya reabrió (en Hoy); la escritura del Backlog sigue en vuelo.
    act(() => convex.publish(stubQuery(api.tasks.bySystem, [{ ...lectura, status: "today", inTodayPlan: true }, beca])));
    expect(titulos()).toEqual(["Leer el capítulo dos", "Pedir la beca"]);

    await act(async () => escritura.responder({ ...lectura, status: "backlog" } as never));
    act(() => convex.publish(stubQuery(api.tasks.bySystem, [lectura, beca])));
    expect(titulos()).toEqual(["Leer el capítulo dos", "Pedir la beca"]);
    expect(screen.getByRole("button", { name: "Completar Leer el capítulo dos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("mover a la papelera no abre una confirmación", async () => {
    const { convex } = pintar();

    await userEvent.click(screen.getAllByRole("button", { name: "Más acciones" })[0]!);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Mover a la papelera" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(convex.calls.some((c) => c.name.startsWith("tasks:") && c.name !== "tasks:toggle")).toBe(true);
  });
});
