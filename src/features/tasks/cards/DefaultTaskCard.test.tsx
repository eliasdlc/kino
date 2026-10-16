/**
 * Criterio: la card por defecto habla español. El estado y el badge de
 * prioridad enseñan su etiqueta («Hoy», «Alta», «Crítica»), nunca el valor
 * del enum que viaja en el transporte («today», «high», «critical»).
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeTestConvexClient } from "@/shared/testing/render";
import type { TaskTransport } from "../tasks.types";
import { DefaultTaskCard } from "./DefaultTaskCard";

function tarea(overrides: Partial<TaskTransport>): TaskTransport {
  return {
    id: "t1",
    title: "Anotar lo que tienes encima ahora mismo",
    status: "today",
    priority: "high",
    effectivePriority: "high",
    energyLevel: "low",
    systemId: "s1",
    ...overrides,
  } as unknown as TaskTransport;
}

describe("DefaultTaskCard", () => {
  it("estado y prioridad alta con su etiqueta en español", () => {
    renderWithProviders(<DefaultTaskCard task={tarea({})} systemId="s1" onToggle={vi.fn()} onDelete={vi.fn()} />, {
      convex: makeTestConvexClient(),
    });
    expect(screen.getByText("Hoy")).toBeVisible();
    expect(screen.getByText("Alta")).toBeVisible();
    expect(screen.queryByText("today")).not.toBeInTheDocument();
    expect(screen.queryByText("high")).not.toBeInTheDocument();
  });

  it("crítica y en backlog, también en español", () => {
    renderWithProviders(
      <DefaultTaskCard task={tarea({ status: "backlog", priority: "critical", effectivePriority: "critical" })} systemId="s1" onToggle={vi.fn()} onDelete={vi.fn()} />,
      { convex: makeTestConvexClient() },
    );
    expect(screen.getByText("Backlog")).toBeVisible();
    expect(screen.getByText("Crítica")).toBeVisible();
    expect(screen.queryByText("critical")).not.toBeInTheDocument();
  });
});
