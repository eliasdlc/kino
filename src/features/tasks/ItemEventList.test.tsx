/**
 * Criterio: la lista por item dice quién escribió, por qué vía y cuándo, con el
 * sujeto delante. Cuando no ha pasado nada lo dice con palabras en vez de dejar
 * un hueco, y cuando hay más de los que caben dice cuántos quedan. El nombre de
 * otra persona no llega a la pantalla; su vía sí.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { creadoPorElAgente, editadoPorOtra } from "./item-events.fixtures";
import { ItemEventList } from "./ItemEventList";

type Respuesta = Parameters<typeof stubQuery<typeof api.eventLog.porItem>>[1];

const conEventos = (value: Respuesta) => makeTestConvexClient([stubQuery(api.eventLog.porItem, value)]);

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
