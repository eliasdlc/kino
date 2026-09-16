/**
 * Qué se prueba: que la barra de GitHub del board no desaparezca cuando no se
 * puede saber el estado de la conexión. El panel vive de una acción, no de una
 * suscripción, y una acción que falla dejaba la carga encendida para siempre:
 * la barra se iba del tablero sin decir nada y no había forma de distinguir una
 * integración apagada de una rota.
 */

import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, TestConvexClient } from "@/shared/testing/render";
import { GithubRepoPanel } from "./GithubRepoPanel";

/** Un backend que rechaza toda acción: GitHub caído, un 500, la red. */
class ClienteQueFalla extends TestConvexClient {
  override action(): Promise<unknown> {
    return Promise.reject(new Error("GitHub respondió 500."));
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
