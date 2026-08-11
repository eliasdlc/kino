import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GithubRepoPanelView } from "./GithubRepoPanelView";

const REPO = { owner: "eliasdlc", repo: "kino" };

describe("GithubRepoPanelView", () => {
  it("sin cuenta conectada manda a Ajustes en vez de ofrecer sincronizar", () => {
    render(<GithubRepoPanelView state={{ kind: "disconnected" }} />);

    expect(screen.getByText(/Conecta GitHub en Ajustes/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Sincronizar/i })).toBeNull();
  });

  it("conectado sin repositorio pide el owner/repo", async () => {
    const onLink = vi.fn();
    render(<GithubRepoPanelView state={{ kind: "unlinked" }} onLink={onLink} />);

    await userEvent.type(
      screen.getByLabelText("Repositorio de GitHub"),
      "eliasdlc/kino",
    );
    await userEvent.click(screen.getByRole("button", { name: /Enlazar/i }));

    expect(onLink).toHaveBeenCalledWith("eliasdlc/kino");
  });

  it("no deja enlazar con el campo vacío", () => {
    render(<GithubRepoPanelView state={{ kind: "unlinked" }} />);

    expect(
      screen.getByRole("button", { name: /Enlazar/i }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("enlazado muestra el repositorio y permite refrescar", async () => {
    const onSync = vi.fn();
    render(
      <GithubRepoPanelView
        state={{ kind: "linked", repo: REPO, revoked: false }}
        onSync={onSync}
      />,
    );

    expect(screen.getByText("eliasdlc/kino")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: /Sincronizar/i }));

    expect(onSync).toHaveBeenCalled();
  });

  it("mientras sincroniza no deja disparar otra vez", () => {
    render(
      <GithubRepoPanelView
        state={{ kind: "linked", repo: REPO, revoked: false }}
        syncing
      />,
    );

    const boton = screen.getByRole("button", { name: /Sincronizando/i });
    expect(boton.hasAttribute("disabled")).toBe(true);
  });

  // Criterio del ticket: revocar el token degrada con un mensaje claro, no rompe.
  it("con el token revocado avisa y bloquea la sincronización sin ocultar el board", () => {
    render(
      <GithubRepoPanelView
        state={{ kind: "linked", repo: REPO, revoked: true }}
      />,
    );

    expect(screen.getByText(/token caducado/i)).toBeDefined();
    expect(screen.getByText("eliasdlc/kino")).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: /Sincronizar/i })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
