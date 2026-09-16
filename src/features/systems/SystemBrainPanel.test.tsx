import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { SystemBrainPanel } from "./SystemBrainPanel";
import type { SystemFact } from "./brain";

/**
 * Qué se prueba: que el bloque nace colapsado y se queda como lo dejaron, que
 * cada hecho enseña la razón de la que sale, y que un sistema sin nada que
 * contar dice eso y no que está tranquilo. El colapso importa dos veces: es la
 * preferencia de la persona y es lo que evita suscribirse a una lectura que
 * nadie ha pedido.
 */

const SISTEMA = "sys_1";

const HECHOS: SystemFact[] = [
  {
    kind: "overdue",
    title: "2 tareas pasaron de fecha",
    reason: "La más vieja es «Entrega 1», del 3 de agosto.",
    target: { kind: "task", id: "task_1" },
    occurredAt: "2026-08-03T16:00:00.000Z",
    weight: 95,
  },
  {
    kind: "empty-container",
    title: "1 clase sin una sola tarea",
    reason: "«Álgebra» se creó el 1 de septiembre y sigue vacía.",
    target: { kind: "folder", id: "folder_1" },
    occurredAt: "2026-09-01T16:00:00.000Z",
    weight: 58,
  },
];

function pintar(brain: { paragraph: string; facts: SystemFact[]; unstarted: boolean }) {
  return renderWithProviders(<SystemBrainPanel systemId={SISTEMA} />, {
    convex: makeTestConvexClient([stubQuery(api.systems.brain, brain)]),
  });
}

const CON_HECHOS = {
  paragraph: "Al 16 de septiembre este sistema tiene 3 tareas vivas, 1 cerrada y 1 clase.",
  facts: HECHOS,
  unstarted: false,
};

describe("SystemBrainPanel", () => {
  it("nace colapsado: no enseña ni el párrafo ni los hechos hasta que se abre", () => {
    pintar(CON_HECHOS);

    expect(screen.getByRole("button", { name: /Cómo va esto/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(CON_HECHOS.paragraph)).not.toBeInTheDocument();
    expect(screen.queryByText(HECHOS[0].title)).not.toBeInTheDocument();
  });

  it("abierto enseña el párrafo y cada hecho con la razón de la que sale", async () => {
    pintar(CON_HECHOS);
    await userEvent.click(screen.getByRole("button", { name: /Cómo va esto/ }));

    expect(screen.getByText(CON_HECHOS.paragraph)).toBeVisible();
    for (const hecho of HECHOS) {
      expect(screen.getByText(hecho.title)).toBeVisible();
      expect(screen.getByText(hecho.reason)).toBeVisible();
    }
  });

  it("el estado se recuerda, así que el siguiente sistema abre como quedó el anterior", async () => {
    const primero = pintar(CON_HECHOS);
    await userEvent.click(screen.getByRole("button", { name: /Cómo va esto/ }));
    expect(localStorage.getItem("systemBrainOpen")).toBe("true");
    primero.unmount();

    pintar(CON_HECHOS);

    expect(screen.getByRole("button", { name: /Cómo va esto/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(CON_HECHOS.paragraph)).toBeVisible();
  });

  it("el hecho de una fila con ruta es un enlace, y el de una tarea es un botón", async () => {
    pintar(CON_HECHOS);
    await userEvent.click(screen.getByRole("button", { name: /Cómo va esto/ }));

    expect(screen.getByRole("link", { name: /1 clase sin una sola tarea/ })).toHaveAttribute(
      "href",
      `/systems/${SISTEMA}/folders/folder_1`,
    );
    expect(screen.getByRole("button", { name: /2 tareas pasaron de fecha/ })).toBeEnabled();
  });

  it("un sistema sin nada que contar lo dice, en vez de decir que está tranquilo", async () => {
    pintar({
      paragraph: "Al 16 de septiembre este sistema está vacío: se creó hoy y todavía no hay nada que contar.",
      facts: [],
      unstarted: true,
    });
    await userEvent.click(screen.getByRole("button", { name: /Cómo va esto/ }));

    expect(screen.getByText("Todavía no hay nada que contar")).toBeVisible();
    expect(screen.queryByText("Nada que señalar")).not.toBeInTheDocument();
  });

  it("un sistema con datos y ningún hecho está tranquilo, que no es lo mismo", async () => {
    pintar({
      paragraph: "Al 16 de septiembre este sistema tiene 2 tareas vivas y 9 cerradas.",
      facts: [],
      unstarted: false,
    });
    await userEvent.click(screen.getByRole("button", { name: /Cómo va esto/ }));

    expect(screen.getByText("Nada que señalar")).toBeVisible();
    expect(screen.queryByText("Todavía no hay nada que contar")).not.toBeInTheDocument();
  });
});
