/**
 * Criterio: Ajustes ofrece como fuente conectada sólo la que tiene código
 * detrás. El schema admite siete proveedores y seis nunca se implementaron;
 * pintarlos sería ofrecer un control que no responde. La fila del índice lo
 * resume desde la misma lista, sin llamar a la acción que pregunta a GitHub.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { CONEXIONES_DESCRIPCION, ConnectionsSection, useConnectionsMeta } from "./ConnectionsSection";

/** Los seis valores del schema que nunca tuvieron código detrás. */
const MUERTOS = ["Google Calendar", "Jira", "Slack", "Microsoft Teams", "Notion", "iCal"];

// `github.status` es una acción, no una query: el panel la llama por su cuenta
// y sin servidor se queda cargando, que es un estado válido para este criterio.
const conFuentes = (value: Parameters<typeof stubQuery<typeof api.connections.list>>[1]) =>
  makeTestConvexClient([stubQuery(api.connections.list, value)]);

describe("ConnectionsSection", () => {
  it("pinta GitHub y ninguno de los seis proveedores sin código", () => {
    renderWithProviders(<ConnectionsSection />, {
      convex: conFuentes([
        { provider: "github", connected: true, lastSyncedAt: null, linkedSystems: 2 },
      ]),
    });
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    for (const muerto of MUERTOS) {
      expect(screen.queryByText(muerto), muerto).toBeNull();
    }
  });

  it("la fila del índice dice si GitHub está conectada, sin preguntarle a GitHub", () => {
    function Meta() {
      return <p>{useConnectionsMeta() ?? "cargando"}</p>;
    }
    const convex = conFuentes([{ provider: "github", connected: false, lastSyncedAt: null, linkedSystems: 0 }]);
    renderWithProviders(<Meta />, { convex });
    expect(screen.getByText("GitHub, sin conectar")).toBeVisible();
    expect(convex.calls).toEqual([]);
    expect(CONEXIONES_DESCRIPCION).toMatch(/no pisa lo que añadas encima/);
  });
});
