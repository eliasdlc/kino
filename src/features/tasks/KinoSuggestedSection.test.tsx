/**
 * Criterio: en lo sugerido, agregar al plan se dice con la palabra "Al plan" y,
 * ya en el plan, con "en el plan" sin el verde de hecha (que es de completar).
 * Una vencida no se sugiere aquí porque tiene su sección, y mientras los
 * ajustes no llegan el presupuesto guarda su sitio con el esqueleto.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { addDays, startOfToday } from "date-fns";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { KinoSuggestedSection } from "./KinoSuggestedSection";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const sugerida = (id: string, title: string, over: Record<string, unknown> = {}) =>
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
    metadata: null,
    inTodayPlan: false,
    ...over,
  }) as unknown as TaskTransport & { inTodayPlan: boolean };

const ajustes = { dailyEnergyLimit: 10 } as never;

function pintar(sugeridas: (TaskTransport & { inTodayPlan: boolean })[], conAjustes = true) {
  const convex = makeTestConvexClient([
    stubQuery(api.insights.suggest, sugeridas as never),
    stubQuery(api.tasks.todayPlan, [] as never),
    ...(conAjustes ? [stubQuery(api.settings.get, ajustes)] : []),
  ]);
  return { ...renderWithProviders(<KinoSuggestedSection />, { convex }), convex };
}

describe("KinoSuggestedSection", () => {
  it("la cola dice Al plan y agregar escribe inTodayPlan", () => {
    const { convex } = pintar([sugerida("a", "Leer el capítulo dos")]);

    const boton = screen.getByRole("button", { name: "Agregar Leer el capítulo dos al plan de hoy" });
    expect(boton).toHaveTextContent("Al plan");

    fireEvent.click(boton);

    expect(convex.calls).toContainEqual(expect.objectContaining({ name: "tasks:update", args: { id: "a", inTodayPlan: true } }));
    expect(screen.getByRole("img", { name: "Leer el capítulo dos ya está en el plan" })).toHaveTextContent("en el plan");
  });

  it("una sugerida que ya está en el plan dice en el plan, sin verde de hecha", () => {
    const { container } = pintar([sugerida("a", "Leer el capítulo dos", { inTodayPlan: true })]);

    expect(screen.getByText("en el plan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /al plan de hoy/ })).toBeNull();
    expect(container.querySelector(".text-task-done")).toBeNull();
  });

  it("una vencida no se lista entre las sugeridas", () => {
    const vencida = sugerida("v", "Entregar el informe", { dueDate: addDays(startOfToday(), -2).toISOString() });
    const { container } = pintar([sugerida("a", "Leer el capítulo dos"), vencida]);

    const titulos = [...container.querySelectorAll("[data-slot=task-row-title]")].map((n) => n.textContent);
    expect(titulos).toEqual(["Leer el capítulo dos"]);
    expect(screen.queryByText("Entregar el informe")).toBeNull();
  });

  it("mientras los ajustes no llegan el esqueleto guarda el sitio del presupuesto", () => {
    const { container, convex } = pintar([sugerida("a", "Leer el capítulo dos")], false);

    expect(container.querySelector("[data-slot=presupuesto-skeleton]")).not.toBeNull();
    expect(screen.queryByText("Energía comprometida")).toBeNull();

    act(() => convex.publish(stubQuery(api.settings.get, ajustes)));

    expect(container.querySelector("[data-slot=presupuesto-skeleton]")).toBeNull();
    expect(screen.getByText("Energía comprometida")).toBeInTheDocument();
  });

  it("D9: el porqué del servidor no llega a la fila sugerida", () => {
    const why = "Vence hoy, prioridad alta, energía media";
    const { container } = pintar([sugerida("a", "Leer el capítulo dos", { why, dueDate: addDays(startOfToday(), 1).toISOString() })]);

    expect(container.querySelector("[data-slot=task-row-title]")).toHaveTextContent("Leer el capítulo dos");
    expect(screen.queryByText(why)).toBeNull();
    expect(container).not.toHaveTextContent(why);
  });
});
