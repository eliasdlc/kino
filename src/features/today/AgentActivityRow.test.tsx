/**
 * Criterio: con cero acciones la fila no se pinta y no deja hueco. Con N, la
 * cifra va delante de la clase y el sujeto es tu agente, nunca Kino. Los dos
 * botones hacen algo: uno abre la lista de las N acciones y el otro las deshace.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from "@/shared/testing/render";
import { AgentActivityRow } from "./AgentActivityRow";

type Resumen = Parameters<typeof stubQuery<typeof api.eventLog.delAgenteHoy>>[1];

const conActividad = (value: Resumen) =>
  makeTestConvexClient(
    [stubQuery(api.eventLog.delAgenteHoy, value)],
    [stubMutation(api.eventLog.deshacerDelAgente, { deshechas: 5, sinDeshacer: [] })],
  );

const cincoAcciones: Resumen = {
  total: 5,
  acciones: [
    { action: "task.create", cuantas: 4 },
    { action: "task.move", cuantas: 1 },
  ],
  sistemas: ["Tesis"],
  ids: [],
};

describe("AgentActivityRow", () => {
  it("la frase pone al agente de sujeto y la cifra delante de la clase", () => {
    renderWithProviders(<AgentActivityRow />, { convex: conActividad(cincoAcciones) });

    const linea = screen.getByText(/Tu agente/);
    expect(linea).toHaveTextContent("Tu agente creó 4 tareas y movió 1 en Tesis.");
    // Kino no es el sujeto de lo que hizo el agente de la persona.
    expect(linea.textContent).not.toContain("Kino");
  });

  it("con cero acciones no se pinta nada: ni hueco ni «sin actividad»", () => {
    const { container } = renderWithProviders(<AgentActivityRow />, { convex: conActividad(null) });

    expect(container).toBeEmptyDOMElement();
  });

  it("«Ver las N acciones» abre la lista y la N coincide con el total", async () => {
    renderWithProviders(<AgentActivityRow />, { convex: conActividad(cincoAcciones) });

    await userEvent.click(screen.getByRole("button", { name: "Ver las 5 acciones" }));

    expect(screen.getByText("creó 4 tareas")).toBeVisible();
    expect(screen.getByText("movió 1 tarea")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ocultar las acciones" })).toBeVisible();
  });

  it("«Deshacer» llama al deshacer en bloque del día", async () => {
    const convex = conActividad(cincoAcciones);
    renderWithProviders(<AgentActivityRow />, { convex });

    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(convex.calls).toEqual([{ kind: "mutation", name: "eventLog:deshacerDelAgente", args: {} }]);
  });

  it("dos tramos de la misma clase no la repiten: el segundo va sólo con la cifra", () => {
    renderWithProviders(<AgentActivityRow />, {
      convex: conActividad({
        total: 6,
        acciones: [
          { action: "task.create", cuantas: 4 },
          { action: "task.move", cuantas: 1 },
          { action: "page.create", cuantas: 1 },
        ],
        sistemas: ["Tesis"],
        ids: [],
      }),
    });

    expect(screen.getByText(/Tu agente/)).toHaveTextContent("Tu agente creó 4 tareas, movió 1 y creó 1 capítulo en Tesis.");
  });

  it("una sola acción se dice en singular", () => {
    renderWithProviders(<AgentActivityRow />, {
      convex: conActividad({ total: 1, acciones: [{ action: "page.create", cuantas: 1 }], sistemas: [], ids: [] }),
    });

    expect(screen.getByText(/Tu agente/)).toHaveTextContent("Tu agente creó 1 capítulo.");
  });
});
