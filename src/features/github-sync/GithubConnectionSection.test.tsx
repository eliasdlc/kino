/**
 * Criterio: la fuente GitHub de Ajustes se lee como una fila y no como una
 * caja: su nombre, una frase que no pone a Kino de sujeto, el estado de la
 * cuenta en palabras y una sola acción con nombre según ese estado (Conectar
 * sin cuenta, Desconectar con ella).
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders } from "@/shared/testing/render";
import { getFunctionName } from "convex/server";
import { GithubConnectionSection } from "./GithubConnectionSection";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const estado = (value: unknown) =>
  makeTestConvexClient([], [{ name: getFunctionName(api.github.status), value }]);

describe("GithubConnectionSection", () => {
  it("con la cuenta conectada dice como quién y ofrece Desconectar", async () => {
    renderWithProviders(<GithubConnectionSection />, {
      convex: estado({ connected: true, login: "eliasdlc", lastSyncedAt: null, revoked: false, configured: true }),
    });

    expect(await screen.findByText(/Conectada como @eliasdlc/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Desconectar" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Conectar" })).toBeNull();
  });

  it("sin cuenta ofrece Conectar, y la frase no hace a Kino el sujeto", async () => {
    renderWithProviders(<GithubConnectionSection />, {
      convex: estado({ connected: false, login: null, lastSyncedAt: null, revoked: false, configured: true }),
    });

    expect(await screen.findByRole("link", { name: "Conectar" })).toBeVisible();
    expect(screen.getByText("Sin cuenta conectada.")).toBeVisible();
    expect(screen.queryByText(/Kino sólo lee/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sólo se lee: nada se escribe en GitHub/)).toBeVisible();
  });
});
