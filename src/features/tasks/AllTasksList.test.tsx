/**
 * Criterio: Todas las tareas dice con palabras lo que filtra y nunca repite lo
 * vencido. La ficha activa se nombra por su valor ("Prioridad crítica"), la
 * hoja de filtros cierra con Limpiar y "Ver N tareas" con la cuenta viva, una
 * vencida vive sólo en Vencidas (también tachada), Seleccionar enseña las
 * casillas de todas las filas y mover a la papelera no pregunta.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays, startOfToday } from "date-fns";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from "@/shared/testing/render";
import { setNavigation, testRouter } from "@/shared/testing/navigation";
import type { TaskTransport } from "./tasks.types";
import { AllTasksList } from "./AllTasksList";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const hace3Dias = addDays(startOfToday(), -3).toISOString();
const en3Dias = addDays(startOfToday(), 3).toISOString();

const tarea = (id: string, title: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    title,
    status: "week",
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    dueDate: null,
    estimatedTime: null,
    taskType: "task",
    systemId: "s1",
    folderId: null,
    parentTaskId: null,
    metadata: null,
    createdAt: "2026-10-01T12:00:00.000Z",
    ...over,
  }) as unknown as TaskTransport;

const sistemas = [{ id: "s1", name: "Universidad", color: null }];

const vencida = tarea("v", "Entregar el informe", { dueDate: hace3Dias });
const lectura = tarea("a", "Leer el capítulo dos");
const beca = tarea("b", "Pedir la beca");

const lista = (items: TaskTransport[]) => stubQuery(api.tasks.list, { items, restantes: 0 } as never);

function pintar(items: TaskTransport[] = [vencida, lectura, beca]) {
  const convex = makeTestConvexClient(
    [lista(items)],
    [stubMutation(api.tasks.remove, { id: "a", title: "Leer el capítulo dos" } as never)],
  );
  return { ...renderWithProviders(<AllTasksList systems={sistemas} />, { convex }), convex };
}

const titulosDe = (region: HTMLElement) => [...region.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);

describe("AllTasksList", () => {
  it("la ficha activa se nombra por su valor, no por el campo", () => {
    setNavigation({ search: "priority=critical" });
    const { unmount } = pintar();
    expect(screen.getByRole("button", { name: "Quitar el filtro Prioridad crítica" })).toBeInTheDocument();
    unmount();

    setNavigation({ search: "dateRange=next7" });
    pintar();
    expect(screen.getByRole("button", { name: "Quitar el filtro Próximos 7 días" })).toBeInTheDocument();
  });

  it("quitar una ficha reescribe la URL sin ese valor", () => {
    setNavigation({ pathname: "/tasks", search: "priority=critical,high&type=idea" });
    pintar();

    fireEvent.click(screen.getByRole("button", { name: "Quitar el filtro Prioridad crítica" }));

    expect(testRouter.replace).toHaveBeenCalledWith("/tasks?priority=high&type=idea", { scroll: false });
  });

  it("la hoja de filtros cierra con Limpiar y Ver N tareas, con N en vivo", () => {
    setNavigation({ search: "priority=critical" });
    const critica = (id: string, title: string) => tarea(id, title, { effectivePriority: "critical", priority: "critical" });
    const { convex } = pintar([lectura, critica("c1", "Pagar la luz"), critica("c2", "Renovar el pasaporte")]);

    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));

    const pie = screen.getByRole("dialog", { name: "Filtros" }).querySelector("[data-slot=filtros-pie]") as HTMLElement;
    expect(within(pie).getByRole("button", { name: "Limpiar" })).toBeEnabled();
    expect(within(pie).getByRole("button", { name: "Ver 2 tareas" })).toBeInTheDocument();

    act(() => convex.publish(lista([lectura, critica("c1", "Pagar la luz")])));

    expect(within(pie).getByRole("button", { name: "Ver 1 tarea" })).toBeInTheDocument();
  });

  it("Limpiar quita los filtros y Ver N tareas cierra la hoja", () => {
    setNavigation({ pathname: "/tasks", search: "priority=critical" });
    pintar();
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(testRouter.replace).toHaveBeenCalledWith("/tasks", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: /^Ver \d+ tareas?$/ }));
    expect(screen.queryByRole("dialog", { name: "Filtros" })).toBeNull();
  });

  it("una vencida está sólo en Vencidas, no en Todas las tareas", () => {
    pintar();

    const vencidas = screen.getByRole("region", { name: "Vencidas" });
    const todas = screen.getByRole("region", { name: "Todas las tareas" });

    expect(titulosDe(vencidas)).toEqual(["Entregar el informe"]);
    expect(titulosDe(todas)).toEqual(["Leer el capítulo dos", "Pedir la beca"]);
  });

  it("completar una vencida la deja tachada en Vencidas y no la pasa a Todas", () => {
    const { convex } = pintar();

    fireEvent.click(screen.getByRole("button", { name: "Completar Entregar el informe" }));
    act(() => convex.publish(lista([{ ...vencida, status: "done" } as TaskTransport, lectura, beca])));

    expect(convex.calls).toContainEqual(expect.objectContaining({ name: "tasks:toggle", args: { id: "v" } }));
    const vencidas = screen.getByRole("region", { name: "Vencidas" });
    const todas = screen.getByRole("region", { name: "Todas las tareas" });
    expect(titulosDe(vencidas)).toEqual(["Entregar el informe"]);
    expect(within(vencidas).getByRole("button", { name: "Completar Entregar el informe" })).toHaveAttribute("aria-pressed", "true");
    expect(titulosDe(todas)).toEqual(["Leer el capítulo dos", "Pedir la beca"]);
    expect(todas).toHaveTextContent("2 tareas");
  });

  it("Seleccionar enseña las casillas de todas las filas sin abrir ninguna hoja", () => {
    pintar();
    const casilla = (titulo: string) => screen.getByRole("checkbox", { name: `Seleccionar ${titulo}` });
    // Antes, la casilla sólo aparece al pasar el ratón por la fila.
    expect(casilla("Pedir la beca").className).toContain("md:opacity-0");

    fireEvent.click(screen.getByRole("button", { name: "Seleccionar" }));

    for (const titulo of ["Entregar el informe", "Leer el capítulo dos", "Pedir la beca"]) {
      expect(casilla(titulo)).toBeVisible();
      expect(casilla(titulo).className).not.toContain("md:opacity-0");
      expect(casilla(titulo)).toHaveAttribute("aria-checked", "false");
    }
    expect(screen.getByRole("button", { name: "Terminar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(casilla("Pedir la beca"));
    expect(casilla("Pedir la beca")).toHaveAttribute("aria-checked", "true");
    expect(casilla("Leer el capítulo dos")).toHaveAttribute("aria-checked", "false");
  });

  it("Mover a la papelera no abre una confirmación y escribe el borrado", async () => {
    const { convex } = pintar([tarea("a", "Leer el capítulo dos", { dueDate: en3Dias })]);

    await userEvent.click(screen.getByRole("button", { name: "Más acciones" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Mover a la papelera" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(convex.calls).toContainEqual(expect.objectContaining({ name: "tasks:remove", args: { id: "a" } }));
  });
});
