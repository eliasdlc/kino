/**
 * Criterio: completar desde Hoy es un toque que tacha la fila en su sitio. La
 * fila hecha no salta ni desaparece hasta la siguiente visita, un aviso de
 * cuatro segundos ofrece Deshacer, y deshacer la devuelve a pendiente en la
 * misma posición. El Deshacer es idempotente: restaura lo de antes, no
 * alterna, y deshacer con el círculo cierra el aviso.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import type { TaskTransport } from "@/features/tasks/tasks.types";

const toastMock = vi.fn<(...args: unknown[]) => string>(() => "aviso-1");
const dismissMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: (...args: unknown[]) => dismissMock(...args),
  }),
}));

function tarea(id: string, title: string, over: Partial<TaskTransport> = {}): TaskTransport {
  return {
    id,
    title,
    status: "today",
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    estimatedTime: null,
    dueDate: null,
    taskType: "task",
    systemId: "s1",
    ...over,
  } as unknown as TaskTransport;
}

// El estado del servidor, que la mutación simulada cambia de verdad: así la
// fila tachada se prueba contra una lista en la que ya consta como hecha.
let tareas: TaskTransport[] = [];
const toggle = vi.fn(({ taskId }: { taskId: string }) => {
  tareas = tareas.map((t) => (t.id === taskId ? { ...t, status: t.status === "done" ? "today" : "done" } : t)) as TaskTransport[];
});

vi.mock("@/features/tasks/tasks.hooks", () => ({
  useTodayPlanTasks: () => ({ data: tareas, isLoading: false }),
  useToggleTodayTask: () => ({ mutate: toggle }),
  useMoveToTomorrow: () => ({ mutate: vi.fn() }),
  useRemoveFromPlan: () => ({ mutate: vi.fn() }),
}));

const { TodayPlanCard, UNDO_MS, CONFETTI_REMOVE_MS } = await import("./TodayPlanCard");

const titulos = () => screen.getAllByText(/Leer|Escribir/).map((el) => el.textContent);
const circulo = (titulo: string) => screen.getByRole("button", { name: `Completar ${titulo}` });
const deshacerDelAviso = () =>
  (toastMock.mock.calls.at(-1) as [string, { action: { onClick: () => void } }])[1].action.onClick;

describe("TodayPlanCard", () => {
  beforeEach(() => {
    toastMock.mockClear();
    dismissMock.mockClear();
    toggle.mockClear();
    tareas = [tarea("a", "Leer el capítulo 3"), tarea("b", "Escribir el resumen")];
  });

  it("tacha la fila en su sitio con un Deshacer de cuatro segundos, y deshacer la devuelve", () => {
    const { rerender } = renderWithProviders(<TodayPlanCard noProfile={false} />);
    expect(titulos()).toEqual(["Leer el capítulo 3", "Escribir el resumen"]);

    fireEvent.click(circulo("Leer el capítulo 3"));
    rerender(<TodayPlanCard noProfile={false} />);

    // Sigue la primera, tachada, con su círculo en --ok.
    expect(titulos()).toEqual(["Leer el capítulo 3", "Escribir el resumen"]);
    expect(screen.getByText("Leer el capítulo 3")).toHaveClass("line-through");
    expect(circulo("Leer el capítulo 3")).toHaveAttribute("aria-pressed", "true");
    expect(circulo("Leer el capítulo 3").firstElementChild?.className).toContain("bg-task-done");
    expect(screen.getByText(/1 hecha/)).toBeInTheDocument();
    expect(screen.queryByText(/hecha hoy$/)).toBeNull();

    expect(toastMock).toHaveBeenCalledTimes(1);
    const [mensaje, opciones] = toastMock.mock.calls[0] as [string, { duration: number; action: { label: string; onClick: () => void } }];
    expect(mensaje).toBe("Hecha: Leer el capítulo 3");
    expect(opciones.duration).toBe(UNDO_MS);
    expect(UNDO_MS).toBe(4000);
    expect(opciones.action.label).toBe("Deshacer");

    opciones.action.onClick();
    rerender(<TodayPlanCard noProfile={false} />);
    expect(toggle).toHaveBeenCalledTimes(2);
    expect(titulos()).toEqual(["Leer el capítulo 3", "Escribir el resumen"]);
    expect(screen.getByText("Leer el capítulo 3")).not.toHaveClass("line-through");
    expect(circulo("Leer el capítulo 3")).toHaveAttribute("aria-pressed", "false");

    // Un segundo toque en el mismo Deshacer no vuelve a completarla.
    opciones.action.onClick();
    rerender(<TodayPlanCard noProfile={false} />);
    expect(toggle).toHaveBeenCalledTimes(2);
    expect(tareas.find((t) => t.id === "a")?.status).toBe("today");
  });

  it("deshacer con el círculo cierra el aviso, y su Deshacer ya no hace nada", () => {
    const { rerender } = renderWithProviders(<TodayPlanCard noProfile={false} />);

    fireEvent.click(circulo("Leer el capítulo 3"));
    rerender(<TodayPlanCard noProfile={false} />);
    const deshacer = deshacerDelAviso();

    fireEvent.click(circulo("Leer el capítulo 3"));
    rerender(<TodayPlanCard noProfile={false} />);
    expect(dismissMock).toHaveBeenCalledWith("aviso-1");
    expect(toggle).toHaveBeenCalledTimes(2);
    expect(tareas.find((t) => t.id === "a")?.status).toBe("today");

    // Si el toque del aviso llega igual, la tarea se queda como estaba.
    deshacer();
    rerender(<TodayPlanCard noProfile={false} />);
    expect(toggle).toHaveBeenCalledTimes(2);
    expect(tareas.find((t) => t.id === "a")?.status).toBe("today");
  });

  it("el Deshacer vale aunque el servidor todavía no haya contestado", () => {
    // La mutación sale pero la lista sigue sin enterarse: el Deshacer se fía
    // del último gesto, no de lo que el servidor ya devolvió.
    toggle.mockImplementationOnce(() => {});
    renderWithProviders(<TodayPlanCard noProfile={false} />);

    fireEvent.click(circulo("Leer el capítulo 3"));
    deshacerDelAviso()();
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("el confeti dura lo que vuela su último punto", () => {
    vi.useFakeTimers();
    try {
      tareas = [tarea("a", "Leer el capítulo 3")];
      const { container } = renderWithProviders(<TodayPlanCard noProfile={false} />);
      fireEvent.click(circulo("Leer el capítulo 3"));
      const puntos = container.querySelectorAll<HTMLElement>("[data-slot=confetti]");
      expect(puntos).toHaveLength(12);
      const ultimo = puntos[puntos.length - 1]!;
      const vuelo = parseInt(ultimo.style.animationDelay, 10) + parseInt(ultimo.style.animation.match(/(\d+)ms/)![1]!, 10);
      expect(CONFETTI_REMOVE_MS).toBeGreaterThan(vuelo);

      act(() => void vi.advanceTimersByTime(vuelo));
      expect(container.querySelectorAll("[data-slot=confetti]")).toHaveLength(12);
      act(() => void vi.advanceTimersByTime(CONFETTI_REMOVE_MS - vuelo));
      expect(container.querySelectorAll("[data-slot=confetti]")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("el plan vacío titula en h3, bajo el h2 de la sección", () => {
    tareas = [];
    renderWithProviders(<TodayPlanCard noProfile={false} />);
    expect(screen.getByRole("heading", { level: 2, name: "Plan de hoy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Nada en el plan" })).toBeInTheDocument();
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("una hecha de una visita anterior no ocupa fila: sólo cuenta", () => {
    tareas = [tarea("a", "Leer el capítulo 3", { status: "done" }), tarea("b", "Escribir el resumen")];
    renderWithProviders(<TodayPlanCard noProfile={false} />);
    expect(titulos()).toEqual(["Escribir el resumen"]);
    expect(screen.getByText("1 hecha hoy")).toBeInTheDocument();
  });
});
