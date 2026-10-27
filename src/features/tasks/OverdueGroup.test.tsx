/**
 * Criterio: Vencidas pinta las filas que se le dan, la tachada en esta visita
 * incluida, en su mismo renglón. "Mover todas" abre una hoja con tres destinos
 * (A hoy, A mañana, A esta semana) y elegir uno mueve de una vez todas las
 * vencidas con un solo cambio de estado.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { addDays, startOfToday } from "date-fns";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { OverdueGroup } from "./OverdueGroup";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const hace3Dias = addDays(startOfToday(), -3).toISOString();

const vencida = (id: string, title: string, status = "week") =>
  ({
    id,
    title,
    status,
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    dueDate: hace3Dias,
    estimatedTime: null,
    taskType: "task",
    systemId: "s1",
    folderId: null,
    metadata: null,
  }) as unknown as TaskTransport;

const sistemas = new Map([["s1", { id: "s1", name: "Universidad", color: null }]]);

function pintar(props: Partial<React.ComponentProps<typeof OverdueGroup>> = {}) {
  const tasks = [vencida("a", "Entregar el informe"), vencida("b", "Pagar la matrícula")];
  const convex = makeTestConvexClient([], [stubMutation(api.tasks.bulkMove, { previous: [] } as never)]);
  const vista = renderWithProviders(
    <OverdueGroup
      tasks={tasks}
      filas={tasks}
      struck={new Set()}
      systemMap={sistemas}
      onOpen={vi.fn()}
      onComplete={vi.fn()}
      {...props}
    />,
    { convex },
  );
  return { ...vista, convex, tasks };
}

describe("OverdueGroup", () => {
  it("pinta las filas que recibe, la tachada en su renglón", () => {
    const hecha = vencida("b", "Pagar la matrícula", "done");
    const { container } = pintar({
      tasks: [vencida("a", "Entregar el informe")],
      filas: [vencida("a", "Entregar el informe"), hecha],
      struck: new Set(["b"]),
    });

    const titulos = [...container.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);
    expect(titulos).toEqual(["Entregar el informe", "Pagar la matrícula"]);
    expect(screen.getByRole("button", { name: "Completar Pagar la matrícula" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Completar Entregar el informe" })).toHaveAttribute("aria-pressed", "false");
    // El título de la sección cuenta sólo las vencidas de ahora, no la tachada.
    expect(screen.getByRole("heading", { name: "Vencidas" }).closest("section")).toHaveTextContent("1 tarea");
  });

  it("Mover todas abre la hoja Mover las vencidas con los tres destinos", () => {
    pintar();

    fireEvent.click(screen.getByRole("button", { name: "Mover todas" }));

    expect(screen.getByRole("dialog", { name: "Mover las vencidas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A hoy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A mañana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A esta semana" })).toBeInTheDocument();
  });

  it("elegir A mañana mueve todas las vencidas a mañana en un solo cambio", () => {
    const { convex } = pintar();

    fireEvent.click(screen.getByRole("button", { name: "Mover todas" }));
    fireEvent.click(screen.getByRole("button", { name: "A mañana" }));

    const movidas = convex.calls.filter((c) => c.name === "tasks:bulkMove");
    expect(movidas).toHaveLength(1);
    expect(movidas[0]!.args).toEqual({ taskIds: ["a", "b"], status: "tomorrow" });
    expect(screen.queryByRole("dialog", { name: "Mover las vencidas" })).toBeNull();
  });

  it("sin filas no pinta la sección", () => {
    const { container } = pintar({ tasks: [], filas: [] });

    expect(container).toBeEmptyDOMElement();
  });
});
