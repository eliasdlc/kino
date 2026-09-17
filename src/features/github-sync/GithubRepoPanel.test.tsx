/**
 * Qué se prueba: que la barra de GitHub del board no desaparezca cuando no se
 * puede saber el estado de la conexión. El panel vive de una acción, no de una
 * suscripción, y una acción que falla dejaba la carga encendida para siempre:
 * la barra se iba del tablero sin decir nada y no había forma de distinguir una
 * integración apagada de una rota.
 */

import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { getFunctionName, type FunctionReference } from "convex/server";
import { renderWithProviders, TestConvexClient } from "@/shared/testing/render";
import { GithubRepoPanel } from "./GithubRepoPanel";

const REPO = { github: { owner: "eliasdlc", repo: "kino" } };

/** Un backend que rechaza toda acción: GitHub caído, un 500, la red. */
class ClienteQueFalla extends TestConvexClient {
  override action(): Promise<unknown> {
    return Promise.reject(new Error("GitHub respondió 500."));
  }
}

/** Un backend con la cuenta conectada, que apunta con qué se llamó a cada refresco. */
class ClienteConectado extends TestConvexClient {
  readonly refrescos: Record<string, unknown>[] = [];

  override action(accion: FunctionReference<"action">, args: Record<string, unknown>): Promise<unknown> {
    if (getFunctionName(accion) === getFunctionName(api.github.status)) {
      return Promise.resolve({ connected: true, login: "eliasdlc", lastSyncedAt: null, revoked: false, configured: true });
    }
    this.refrescos.push(args);
    return Promise.resolve({ imported: 0, updated: 0, unchanged: 0, sprintsCreated: 0, truncated: false, syncedAt: new Date().toISOString() });
  }
}

describe("GithubRepoPanel", () => {
  it("con la acción de estado fallando, dice que falló y ofrece reintentar", async () => {
    renderWithProviders(<GithubRepoPanel systemId="sistema-1" metadata={null} />, {
      convex: new ClienteQueFalla(),
    });

    expect(await screen.findByText(/No se pudo comprobar la conexión con GitHub/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeVisible();
  });
});

describe("el refresco completo", () => {
  // La salida cuando el cursor se quedó por detrás: sin ella, quien herede un
  // cursor que saltó issues no tiene forma de recuperarlos desde la pantalla.
  it("pide el repositorio desde el principio, y el refresco de cada día no", async () => {
    const convex = new ClienteConectado();
    renderWithProviders(<GithubRepoPanel systemId="sistema-1" metadata={REPO} />, { convex });

    // El primero es el refresco automático al abrir el tablero.
    await waitFor(() => expect(convex.refrescos).toHaveLength(1));
    expect(convex.refrescos[0]).toEqual({ id: "sistema-1" });

    await userEvent.click(await screen.findByRole("button", { name: /Volver a empezar el recorrido/i }));

    await waitFor(() => expect(convex.refrescos).toHaveLength(2));
    expect(convex.refrescos[1]).toEqual({ id: "sistema-1", refrescoCompleto: true });

    await userEvent.click(screen.getByRole("button", { name: /^Sincronizar$/i }));

    await waitFor(() => expect(convex.refrescos).toHaveLength(3));
    expect(convex.refrescos[2]).toEqual({ id: "sistema-1" });
  });

  it("dice lo que cuesta antes de pulsarlo", async () => {
    renderWithProviders(<GithubRepoPanel systemId="sistema-1" metadata={REPO} />, { convex: new ClienteConectado() });

    expect(await screen.findByText(/llevan más tiempo sin cambiar/i)).toBeVisible();
    expect(screen.getByText(/varias veces hasta llegar a hoy/i)).toBeVisible();
  });
});
