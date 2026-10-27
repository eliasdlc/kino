/**
 * Criterio: una lista tacha sin moverse. Al completar, la fila se tacha en su
 * renglón y se queda aunque la suscripción ya no la traiga (lo sugerido deja
 * de sugerir una hecha); el aviso ofrece Deshacer, y Deshacer devuelve la
 * tarea a donde estaba (estado y plan de hoy) una sola vez aunque se pulse
 * tarde, porque la mutación es un flip. Lo tachado vive sólo en su visita.
 * Un Deshacer de un gesto viejo no toca uno nuevo, y si reabrir falla la fila
 * vuelve a quedar tachada.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubMutationError, stubMutationPending } from "@/shared/testing/render";
import type { TaskStatus } from "./tasks.state-machine";
import type { TaskTransport } from "./tasks.types";
import { TaskRow } from "./TaskRow";
import { useListaTachable, useTacharEnSitio } from "./useTachar";

const toastMock = vi.fn<(...args: unknown[]) => string>(() => "aviso");
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() }),
}));

/** Lo que el servidor contesta a `tasks:toggle` de una tarea hecha: la reabre en Hoy. */
const REABIERTA = { status: "today", completedBy: null, completedVia: null, observedMinutes: 0 } as const;
const reabierta = stubMutation(api.tasks.toggle, REABIERTA);

const tarea = (id: string, title: string, status = "week", inTodayPlan = status === "today") =>
  ({ id, title, status, inTodayPlan, priority: "medium", effectivePriority: "medium", energyLevel: "medium", dueDate: null, estimatedTime: null, taskType: "task", systemId: "s1" }) as unknown as TaskTransport;

const deshacerDelAviso = () => (toastMock.mock.calls.at(-1)![1] as { action: { onClick: () => void } }).action.onClick();

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
  beforeEach(() => {
    toastMock.mockClear();
    vi.mocked(toast.error).mockClear();
  });

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

  it("D3: el Deshacer reabre con toggle y, si quedó en otro estado, escribe el guardado, una sola vez", async () => {
    const toggle = vi.fn();
    const convex = makeTestConvexClient([], [reabierta]);
    renderWithProviders(<Lista items={[tarea("a", "Primera", "backlog")]} toggle={toggle} />, { convex });
    fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));
    const opciones = toastMock.mock.calls[0]![1] as { action: { label: string; onClick: () => void }; duration: number };
    expect(opciones.action.label).toBe("Deshacer");
    expect(opciones.duration).toBe(4000);
    opciones.action.onClick();
    opciones.action.onClick();
    // Completar es un flip del padre; deshacer no lo repite: reabre por el
    // servidor (que limpia completedAt) y sólo entonces escribe el estado.
    await vi.waitFor(() => expect(convex.calls.filter((c) => c.name === "tasks:update")).toHaveLength(1));
    expect(toggle.mock.calls).toEqual([["a"]]);
    expect(convex.calls.map((c) => [c.name, c.args])).toEqual([
      ["tasks:toggle", { id: "a" }],
      ["tasks:update", { id: "a", status: "backlog", inTodayPlan: false }],
    ]);
  });

  it("D3b: si la reapertura ya deja la tarea en su sitio, Deshacer no escribe estado", async () => {
    const reapertura = stubMutationPending(api.tasks.toggle);
    const convex = makeTestConvexClient([], [reapertura.stub]);
    renderWithProviders(<Lista items={[tarea("a", "Primera", "today")]} toggle={vi.fn()} />, { convex });
    fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));
    deshacerDelAviso();
    await vi.waitFor(() => expect(convex.calls.map((c) => c.name)).toEqual(["tasks:toggle"]));
    // El servidor contesta la reapertura; una vuelta del bucle de eventos deja
    // correr entera la cadena que decide si escribir el estado.
    await act(async () => reapertura.responder(REABIERTA));
    await act(() => new Promise((listo) => setTimeout(listo, 0)));
    expect(convex.calls.map((c) => c.name)).toEqual(["tasks:toggle"]);
  });

  it("E6: Deshacer devuelve al plan de hoy una tarea de la semana que estaba en él", async () => {
    const convex = makeTestConvexClient([], [reabierta]);
    renderWithProviders(<Lista items={[tarea("a", "Primera", "week", true)]} toggle={vi.fn()} />, { convex });
    fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));
    deshacerDelAviso();
    await vi.waitFor(() => expect(convex.calls.filter((c) => c.name === "tasks:update")).toHaveLength(1));
    expect(convex.calls.at(-1)!.args).toEqual({ id: "a", status: "week", inTodayPlan: true });
  });

  it("E5: si el estado guardado no se puede escribir después de reabrir, se dice", async () => {
    const convex = makeTestConvexClient([], [reabierta, stubMutationError(api.tasks.update, new Error("Sin conexión"))]);
    renderWithProviders(<Lista items={[tarea("a", "Primera", "week")]} toggle={vi.fn()} />, { convex });
    fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));
    deshacerDelAviso();
    await vi.waitFor(() => expect(convex.calls.map((c) => c.name)).toEqual(["tasks:toggle", "tasks:update"]));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it("E3: la página siguiente no ve en su primer render lo tachado en la anterior", () => {
    const equis = tarea("x", "Equis", "backlog");
    function Anterior() {
      const { handleToggle } = useTacharEnSitio(vi.fn());
      return <button onClick={() => handleToggle(equis)}>Tachar</button>;
    }
    const vistos: TaskStatus[] = [];
    function Siguiente() {
      const { estadoDe } = useTacharEnSitio(vi.fn());
      vistos.push(estadoDe({ ...equis, status: "done" }));
      return null;
    }
    const { rerender } = renderWithProviders(<Anterior />, { convex: makeTestConvexClient() });
    fireEvent.click(screen.getByRole("button", { name: "Tachar" }));
    rerender(<Siguiente />);
    // Hecha y sin tachar en esta visita: se filtra como hecha desde el primer render.
    expect(vistos[0]).toBe("done");
  });

  it("deshacer con el círculo cierra el aviso y el Deshacer del aviso ya no hace nada", async () => {
    const toggle = vi.fn();
    const convex = makeTestConvexClient([], [reabierta]);
    const { rerender } = renderWithProviders(<Lista items={[tarea("a", "Primera", "week")]} toggle={toggle} />, { convex });
    fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));
    const opciones = toastMock.mock.calls[0]![1] as { action: { onClick: () => void } };
    rerender(<Lista items={[tarea("a", "Primera", "done")]} toggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));
    expect(toast.dismiss).toHaveBeenCalledWith("aviso");
    opciones.action.onClick();
    await vi.waitFor(() => expect(convex.calls.filter((c) => c.name === "tasks:update")).toHaveLength(1));
    expect(convex.calls.map((c) => [c.name, c.args])).toEqual([
      ["tasks:toggle", { id: "a" }],
      ["tasks:update", { id: "a", status: "week", inTodayPlan: false }],
    ]);
  });

  const aviso = (n: number) => (toastMock.mock.calls[n]![1] as { action: { onClick: () => void } }).action.onClick;
  const esperar = () => act(() => new Promise((listo) => setTimeout(listo, 20)));
  const completar = () => fireEvent.click(screen.getByRole("button", { name: "Completar Primera" }));

  it("G2: el Deshacer tardío de un gesto viejo no deshace la tachadura nueva", async () => {
    const convex = makeTestConvexClient([], [reabierta, stubMutation(api.tasks.update, {} as never)]);
    const { rerender } = renderWithProviders(<Lista items={[tarea("a", "Primera", "week")]} toggle={vi.fn()} />, { convex });
    completar();
    rerender(<Lista items={[tarea("a", "Primera", "done")]} toggle={vi.fn()} />);
    await act(async () => aviso(0)());
    await vi.waitFor(() => expect(convex.calls.map((c) => c.name)).toEqual(["tasks:toggle", "tasks:update"]));
    await esperar();
    rerender(<Lista items={[tarea("a", "Primera", "week")]} toggle={vi.fn()} />);
    completar();
    rerender(<Lista items={[tarea("a", "Primera", "done")]} toggle={vi.fn()} />);
    const antes = convex.calls.length;
    // El aviso del primer gesto llega tarde: la persona ya tachó otra vez.
    await act(async () => aviso(0)());
    await esperar();
    expect(convex.calls).toHaveLength(antes);
    expect(screen.getByRole("button", { name: "Completar Primera" })).toHaveAttribute("aria-pressed", "true");
  });

  it("G3: si reabrir falla, la fila vuelve a quedar tachada y su círculo ofrece Deshacer otra vez", async () => {
    const convex = makeTestConvexClient([], [stubMutationError(api.tasks.toggle, new Error("Sin conexión"))]);
    const { rerender, container } = renderWithProviders(<Lista items={[tarea("a", "Primera", "week")]} toggle={vi.fn()} />, { convex });
    completar();
    rerender(<Lista items={[tarea("a", "Primera", "done")]} toggle={vi.fn()} />);
    await act(async () => aviso(0)());
    await vi.waitFor(() => expect(convex.calls.filter((c) => c.name === "tasks:toggle")).toHaveLength(1));
    await esperar();
    expect(container.querySelector("[data-struck]")).not.toBeNull();
    // El círculo reintenta por el mismo camino de reabrir, no por el padre.
    completar();
    await vi.waitFor(() => expect(convex.calls.filter((c) => c.name === "tasks:toggle")).toHaveLength(2));
  });

  it("G4: tachar otra vez mientras Deshacer escribe conserva el sitio de antes", async () => {
    const escritura = stubMutationPending(api.tasks.update);
    const convex = makeTestConvexClient([], [reabierta, escritura.stub]);
    const { rerender } = renderWithProviders(<Lista items={[tarea("a", "Primera", "week")]} toggle={vi.fn()} />, { convex });
    completar();
    rerender(<Lista items={[tarea("a", "Primera", "done")]} toggle={vi.fn()} />);
    await act(async () => aviso(0)());
    await vi.waitFor(() => expect(convex.calls.map((c) => c.name)).toContain("tasks:update"));
    // Reabierta en Hoy con la escritura en vuelo, la persona la tacha de nuevo.
    rerender(<Lista items={[tarea("a", "Primera", "today")]} toggle={vi.fn()} />);
    completar();
    rerender(<Lista items={[tarea("a", "Primera", "done")]} toggle={vi.fn()} />);
    await act(async () => escritura.responder({} as never));
    await act(async () => aviso(1)());
    await esperar();
    // El segundo Deshacer reabre y escribe el sitio de antes por su cuenta.
    expect(convex.calls.map((c) => c.name).slice(-2)).toEqual(["tasks:toggle", "tasks:update"]);
    expect(convex.calls.at(-1)!.args).toEqual({ id: "a", status: "week", inTodayPlan: false });
  });
});
