/**
 * Criterio: Ajustes ofrece como fuente conectada sólo la que tiene código
 * detrás, y la fila del índice y la hoja dicen el mismo estado de GitHub:
 * conectada, sin conectar, o no disponible en esta instalación. Con la
 * cuenta enlazada no se pregunta nada; sin ella sólo se pregunta al servidor
 * si la integración existe, sin hablar con GitHub.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

import { screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery, type QueryStub } from "@/shared/testing/render";
import { ConnectionsSection } from "./ConnectionsSection";
import { CONEXIONES_DESCRIPCION } from "./settings-copy";
import { useConnectionsMeta } from "./settings.hooks";

/** Los seis valores del schema que nunca tuvieron código detrás. */
const MUERTOS = ["Google Calendar", "Jira", "Slack", "Microsoft Teams", "Notion", "iCal"];

type Fuentes = Parameters<typeof stubQuery<typeof api.connections.list>>[1];

/** Lo que responde `github.status` sin token guardado: no habla con GitHub. */
function estadoGithub(configured: boolean): QueryStub {
  return { name: getFunctionName(api.github.status), value: { connected: false, login: null, lastSyncedAt: null, revoked: false, configured } };
}

const cliente = (fuentes: Fuentes, configured = true) =>
  makeTestConvexClient([stubQuery(api.connections.list, fuentes)], [estadoGithub(configured)]);

const SIN_CONECTAR: Fuentes = [{ provider: "github", connected: false, lastSyncedAt: null, linkedSystems: 0 }];

function Meta() {
  return <p>{useConnectionsMeta() ?? "cargando"}</p>;
}

describe("ConnectionsSection", () => {
  it("pinta GitHub y ninguno de los seis proveedores sin código", () => {
    renderWithProviders(<ConnectionsSection />, {
      convex: cliente([{ provider: "github", connected: true, lastSyncedAt: null, linkedSystems: 2 }]),
    });
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    for (const muerto of MUERTOS) {
      expect(screen.queryByText(muerto), muerto).toBeNull();
    }
    expect(CONEXIONES_DESCRIPCION).toMatch(/no pisa lo que añadas encima/);
  });

  it("con la cuenta enlazada la fila dice conectada sin preguntar nada", () => {
    const convex = cliente([{ provider: "github", connected: true, lastSyncedAt: null, linkedSystems: 1 }]);
    renderWithProviders(<Meta />, { convex });
    expect(screen.getByText("GitHub, conectada")).toBeVisible();
    expect(convex.calls).toEqual([]);
  });

  it("sin cuenta enlazada y con la integración, la fila invita a conectar", async () => {
    const convex = cliente(SIN_CONECTAR, true);
    renderWithProviders(<Meta />, { convex });
    expect(await screen.findByText("GitHub, sin conectar")).toBeVisible();
    expect(convex.calls).toEqual([{ kind: "action", name: "github:status", args: {} }]);
  });

  it("sin la integración, la fila y la hoja dicen que no está disponible y no ofrecen conectar", async () => {
    renderWithProviders(<Meta />, { convex: cliente(SIN_CONECTAR, false) });
    expect(await screen.findByText("GitHub, no disponible aquí")).toBeVisible();

    renderWithProviders(<ConnectionsSection />, { convex: cliente(SIN_CONECTAR, false) });
    expect(await screen.findByText(/No disponible en esta instalación/)).toBeVisible();
    expect(screen.queryByText("Cuenta conectada")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Conectar" })).not.toBeInTheDocument();
  });
});
