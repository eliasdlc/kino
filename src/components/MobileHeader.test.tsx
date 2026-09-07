/**
 * Criterio: en el teléfono hay un solo botón de nueva tarea, el orbe de la
 * barra inferior. La cabecera tenía otro a 56 px de distancia vertical, dos
 * puertas para el mismo gesto y ninguna para buscar.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderMobile } from "@/shared/testing/render";
import { MobileHeader } from "./MobileHeader";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

describe("MobileHeader", () => {
  it("no repite el botón de nueva tarea: sólo el menú y el nombre", () => {
    renderMobile(
      <SidebarProvider>
        <MobileHeader />
      </SidebarProvider>,
    );

    expect(screen.queryByRole("button", { name: "Nueva tarea" })).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Kino" })).toBeVisible();
  });
});
