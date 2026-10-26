/**
 * Criterio: el botón de cuenta del sidebar, plegado o no, mide al menos
 * 2,85 rem con un puntero táctil.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { SidebarUserMenuView } from "./SidebarUserMenu";

describe("SidebarUserMenuView", () => {
  it("con puntero táctil, el botón de cuenta mide al menos 2,85 rem", () => {
    renderWithProviders(<SidebarUserMenuView userName="Ada Lovelace" onSignOut={() => {}} />);
    expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toHaveClass("pointer-coarse:min-h-[2.85rem]");
  });

  it("plegado, además, no baja de 2,85 rem de ancho", () => {
    renderWithProviders(<SidebarUserMenuView userName="Ada Lovelace" collapsed onSignOut={() => {}} />);
    expect(screen.getByRole("button", { name: "Cuenta de Ada Lovelace" })).toHaveClass(
      "pointer-coarse:min-h-[2.85rem]",
      "pointer-coarse:min-w-[2.85rem]",
    );
  });
});
