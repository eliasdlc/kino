/**
 * Qué se prueba: que el panel de GitHub nunca ofrece sincronizar algo que no
 * puede sincronizar. Los cinco estados de la conexión (sin cuenta, sin
 * repositorio, enlazado, token caducado, y no se pudo comprobar) tienen que
 * llevar a una acción distinta, y las dos formas de equivocarse aquí son dejar
 * el botón vivo cuando la llamada de detrás va a fallar, y no enseñar nada.
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

  it("mientras vuelve al primer issue lo dice en la etiqueta y no deja disparar otra vez", () => {
    renderWithProviders(
      <GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: false }} syncing syncingAll />,
    );

    expect(screen.getByRole("button", { name: /Volviendo al primer issue/i })).toBeDisabled();
    // Y el de cada día no se disfraza del otro.
    expect(screen.getByRole("button", { name: /^Sincronizar$/i })).toBeDisabled();
  });

  // El trabajo en curso se cuenta en la etiqueta y en ningún otro sitio: una
  // animación en bucle no dice nada que el texto no diga, y el icono girando
  // mientras su etiqueta decía «Sincronizar» en reposo afirmaba lo contrario de
  // lo que estaba pasando.
  it.each([
    ["el refresco de cada día", { syncing: true }],
    ["el que vuelve al primer issue", { syncing: true, syncingAll: true }],
  ])("no pinta ninguna animación en bucle mientras corre %s", (_caso, props) => {
    const { container } = renderWithProviders(
      <GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: false }} {...props} />,
    );

    expect(container.querySelectorAll("[class*='animate-']")).toHaveLength(0);
  });

  it("con el token caducado tampoco deja volver al primer issue", () => {
    renderWithProviders(<GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: true }} />);

    expect(screen.getByRole("button", { name: /Volver al primer issue/i })).toBeDisabled();
  });

  // Lo que el backend hace de verdad: tres páginas de cien por pasada, así que
  // un repositorio grande no cabe en una. Prometerlo entero era mentira.
  it("dice que el recorrido avanza por tramos, no que traiga el repositorio entero de una vez", () => {
    renderWithProviders(<GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: false }} />);

    expect(screen.getByText(/avanza de trescientos en trescientos/i)).toBeVisible();
    expect(screen.getByText(/varias veces hasta llegar a hoy/i)).toBeVisible();
  });

  it("cuando no se pudo comprobar la conexión lo dice y deja reintentar", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<GithubRepoPanelView state={{ kind: "error" }} onRetry={onRetry} />);

    expect(screen.getByText(/No se pudo comprobar la conexión con GitHub/i)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Reintentar/i }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("con el token revocado avisa y bloquea la sincronización sin ocultar el board", () => {
    renderWithProviders(<GithubRepoPanelView state={{ kind: "linked", repo: REPO, revoked: true }} />);

    expect(screen.getByText(/token caducado/i)).toBeVisible();
    expect(screen.getByText("eliasdlc/kino")).toBeVisible();
    expect(screen.getByRole("button", { name: /Sincronizar/i })).toBeDisabled();
  });
});
