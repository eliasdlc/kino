/**
 * Criterio: Ajustes ofrece como fuente conectada sólo la que tiene código
 * detrás. El schema admite siete proveedores y seis nunca se implementaron;
 * pintarlos sería ofrecer un control que no responde.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { ConnectionsSection } from "./ConnectionsSection";

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
        { provider: "github", connected: true, lastSyncedAt: null, syncedThrough: null, linkedSystems: 2 },
      ]),
    });
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    for (const muerto of MUERTOS) {
      expect(screen.queryByText(muerto), muerto).toBeNull();
    }
  });

  it("dice que lo que traiga una fuente no pisa lo que añadas encima", () => {
    renderWithProviders(<ConnectionsSection />, { convex: conFuentes([]) });
    expect(screen.getByText(/no pisa lo que añadas encima/)).toBeVisible();
  });
});
