/**
 * Criterio: la lista por item dice quién escribió, por qué vía y cuándo, con el
 * sujeto delante. Cuando no ha pasado nada lo dice con palabras en vez de dejar
 * un hueco. Y la autoría del agente no se pinta como un punto ni una insignia:
 * lo que parece control es control, y aquí todavía no hay nada que pulsar.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import type { ItemEvent } from "./item-events";
import { ItemEventList } from "./ItemEventList";

type Respuesta = Parameters<typeof stubQuery<typeof api.eventLog.porItem>>[1];

const conEventos = (value: Respuesta) => makeTestConvexClient([stubQuery(api.eventLog.porItem, value)]);

const hace = (ms: number) => new Date(Date.now() - ms).toISOString();

const creadoPorElAgente: ItemEvent = {
  id: "eventLog:1" as ItemEvent["id"],
  action: "task.create",
  actor: { kind: "propio" as const, channel: "oauth" as const, name: "Elias" },
  occurredAt: hace(120_000),
  undoneAt: null,
  undoneFields: null,
  desdePropuesta: false,
};

const editadoPorOtra: ItemEvent = {
  id: "eventLog:2" as ItemEvent["id"],
  action: "task.update",
  actor: { kind: "redactado" as const, channel: "session" as const },
  occurredAt: hace(3 * 3_600_000),
  undoneAt: null,
  undoneFields: null,
  desdePropuesta: false,
};

describe("ItemEventList", () => {
  it("cada fila dice quién, por qué vía y cuándo, con el sujeto delante", () => {
    renderWithProviders(<ItemEventList targetType="task" targetId="tasks:1" />, {
      convex: conEventos({ items: [creadoPorElAgente, editadoPorOtra], restantes: 0 }),
    });

    expect(screen.getByText(/Tu agente creó esta tarea · hace 2 minutos/)).toBeVisible();
    expect(screen.getByText(/Otra persona editó esta tarea · hace 3 horas/)).toBeVisible();
  });

  it("el nombre de otra persona no llega a la pantalla, pero su vía sí", () => {
    const { container } = renderWithProviders(<ItemEventList targetType="task" targetId="tasks:1" />, {
      convex: conEventos({
        items: [{ ...editadoPorOtra, actor: { kind: "redactado", channel: "oauth" } }],
        restantes: 0,
      }),
    });

    expect(screen.getByText(/El agente de otra persona/)).toBeVisible();
    expect(container.textContent).not.toContain("Elias");
  });

  it("la autoría del agente no pinta ningún control: no hay botón ni enlace en la lista", () => {
    renderWithProviders(<ItemEventList targetType="task" targetId="tasks:1" />, {
      convex: conEventos({ items: [creadoPorElAgente], restantes: 0 }),
    });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("un evento deshecho lo dice en su propia fila", () => {
    renderWithProviders(<ItemEventList targetType="task" targetId="tasks:1" />, {
      convex: conEventos({
        items: [{ ...creadoPorElAgente, undoneAt: hace(60_000), undoneFields: ["title"] }],
        restantes: 0,
      }),
    });

    expect(screen.getByText(/deshecho después/)).toBeVisible();
  });

  it("sin eventos lo dice con palabras, no con un hueco", () => {
    renderWithProviders(<ItemEventList targetType="task" targetId="tasks:1" />, {
      convex: conEventos({ items: [], restantes: 0 }),
    });

    expect(screen.getByText("Aquí no ha pasado nada todavía.")).toBeVisible();
  });

  it("cuando hay más de los que caben, dice cuántos quedan y hasta dónde llega el log", () => {
    renderWithProviders(<ItemEventList targetType="task" targetId="tasks:1" />, {
      convex: conEventos({ items: [creadoPorElAgente], restantes: 12 }),
    });

    expect(screen.getByText(/Hay 12 más antes de éstos, dentro de los treinta días que se guardan/)).toBeVisible();
  });

  it("mientras carga no hay spinner: el hueco tiene la forma de la lista", () => {
    renderWithProviders(<ItemEventList targetType="task" targetId="tasks:1" />, { convex: makeTestConvexClient([]) });

    expect(screen.getByLabelText("Cargando la actividad")).toBeVisible();
  });
});
