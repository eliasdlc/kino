/**
 * Qué se prueba: que el panel de GitHub nunca ofrece sincronizar algo que no
 * puede sincronizar. Los cuatro estados de la conexión (sin cuenta, sin
 * repositorio, enlazado, token caducado) tienen que llevar a una acción
 * distinta, y la única forma de equivocarse aquí es dejar el botón vivo
 * cuando la llamada de detrás va a fallar.
 */

import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { GithubRepoPanelView } from "./GithubRepoPanelView";

const REPO = { owner: "eliasdlc", repo: "kino" };

describe("GithubRepoPanelView", () => {
  it("sin cuenta conectada manda a Ajustes en vez de ofrecer sincronizar", () => {
    renderWithProviders(<GithubRepoPanelView state={{ kind: "disconnected" }} />);

    expect(screen.getByText(/Conecta GitHub en Ajustes/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Sincronizar/i })).not.toBeInTheDocument();
  });

  it("conectado sin repositorio pide el owner/repo", async () => {
    const onLink = vi.fn();
    renderWithProviders(<GithubRepoPanelView state={{ kind: "unlinked" }} onLink={onLink} />);

    await userEvent.type(screen.getByLabelText("Repositorio de GitHub"), "eliasdlc/kino");
    await userEvent.click(screen.getByRole("button", { name: /Enlazar/i }));

    expect(onLink).toHaveBeenCalledWith("eliasdlc/kino");
  });

  it("no deja enlazar con el campo vacío", () => {
    renderWithProviders(<GithubRepoPanelView state={{ kind: "unlinked" }} />);

    expect(screen.getByRole("button", { name: /Enlazar/i })).toBeDisabled();
  });

  it("enlazado muestra el repositorio y permite refrescar", async () => {
    const onSync = vi.fn();
    renderWithProviders(
      <GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: false }} onSync={onSync} />,
    );

    expect(screen.getByText("eliasdlc/kino")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Sincronizar/i }));

    expect(onSync).toHaveBeenCalled();
  });

  it("mientras sincroniza no deja disparar otra vez", () => {
    renderWithProviders(
      <GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: false }} syncing />,
    );

    expect(screen.getByRole("button", { name: /Sincronizando/i })).toBeDisabled();
  });

  it("con el token revocado avisa y bloquea la sincronización sin ocultar el board", () => {
    renderWithProviders(<GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: true }} />);

    expect(screen.getByText(/token caducado/i)).toBeVisible();
    expect(screen.getByText("eliasdlc/kino")).toBeVisible();
    expect(screen.getByRole("button", { name: /Sincronizar/i })).toBeDisabled();
  });
});
