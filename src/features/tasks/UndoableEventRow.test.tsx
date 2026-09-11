/**
 * Criterio: una fila deshacible trae su botón y lo pulsa de verdad; una que no
 * lo es dice por qué, en palabras, y no pinta ningún botón muerto. Un rechazo
 * del servidor llega a la pantalla con su motivo en vez de fallar en silencio.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation } from "@/shared/testing/render";
import { creadoPorElAgente, tiempoApuntado } from "./item-events.fixtures";
import { UndoableEventRow } from "./UndoableEventRow";

const enLista = (fila: React.ReactNode) => <ul>{fila}</ul>;

describe("UndoableEventRow", () => {
  it("la fila deshacible trae botón y llama al deshacer con su id", async () => {
    const convex = makeTestConvexClient([], [stubMutation(api.eventLog.deshacer, { deshecho: true })]);

    renderWithProviders(enLista(<UndoableEventRow evento={creadoPorElAgente} />), { convex });
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(convex.calls).toEqual([
      { kind: "mutation", name: "eventLog:deshacer", args: { id: creadoPorElAgente.id } },
    ]);
  });

  it("un rechazo del servidor llega a la pantalla con su motivo", async () => {
    const convex = makeTestConvexClient(
      [],
      [stubMutation(api.eventLog.deshacer, { deshecho: false, motivo: "Esto ya se deshizo." })],
    );

    renderWithProviders(enLista(<UndoableEventRow evento={creadoPorElAgente} />), { convex });
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(await screen.findByText("Esto ya se deshizo.")).toBeVisible();
  });

  it("la que no se puede deshacer dice por qué y no pinta botón", () => {
    renderWithProviders(enLista(<UndoableEventRow evento={tiempoApuntado} />), { convex: makeTestConvexClient([]) });

    expect(screen.getByText(/borrarlo sería borrar que trabajaste/)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("un evento ya deshecho lo dice en su propia fila", () => {
    const deshecho = { ...creadoPorElAgente, undoneAt: new Date(Date.now() - 60_000).toISOString() };
    renderWithProviders(enLista(<UndoableEventRow evento={deshecho} />), { convex: makeTestConvexClient([]) });

    expect(screen.getByText(/deshecho hace 1 minuto/)).toBeVisible();
  });
});
