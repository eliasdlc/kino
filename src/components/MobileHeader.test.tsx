/**
 * Criterio: la cabecera del teléfono tiene dos formas. En una pantalla raíz,
 * la marca y una puerta a Ajustes de 48 px que se lee (la palabra, no un
 * glifo). En una anidada, «‹ padre» con el nombre del padre, que para un
 * sistema sale de la lista de sistemas. Ningún h1 vive aquí: va con la página.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { MobileHeader } from "./MobileHeader";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

describe("MobileHeader", () => {
  it("en una pantalla raíz lleva la marca y la puerta a Ajustes, sin menú lateral", () => {
    renderMobile(<MobileHeader rutaActual="/tasks" />);

    expect(screen.getByRole("link", { name: "Kino" })).toHaveAttribute("href", "/dashboard");
    const puerta = screen.getByRole("link", { name: "Ajustes" });
    expect(puerta).toHaveAttribute("href", "/settings");
    expect(puerta.className).toContain("h-[2.85rem]");
    expect(screen.queryByRole("button", { name: "Abrir menú" })).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("un sistema vuelve a Sistemas", () => {
    renderMobile(<MobileHeader rutaActual="/systems/abc" />);
    const volver = screen.getByRole("link", { name: "Sistemas" });
    expect(volver).toHaveAttribute("href", "/systems");
    expect(screen.queryByRole("link", { name: "Ajustes" })).toBeNull();
  });

  it("dentro de un sistema vuelve al sistema, con su nombre", () => {
    const convex = makeTestConvexClient([
      stubQuery(api.systems.list, [
        { id: "abc", name: "La casa de las cotas", isInbox: false } as never,
      ]),
    ]);
    renderMobile(<MobileHeader rutaActual="/systems/abc/codex" />, { convex });
    const volver = screen.getByRole("link", { name: "La casa de las cotas" });
    expect(volver).toHaveAttribute("href", "/systems/abc");
  });

  it("Ajustes vuelve a Hoy", () => {
    renderMobile(<MobileHeader rutaActual="/settings" />);
    expect(screen.getByRole("link", { name: "Hoy" })).toHaveAttribute("href", "/dashboard");
  });

  it("no lleva vidrio ni desenfoque", () => {
    renderMobile(<MobileHeader rutaActual="/dashboard" />);
    expect(screen.getByRole("banner").className).not.toMatch(/backdrop-blur|glass/);
  });
});
