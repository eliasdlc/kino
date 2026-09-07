/**
 * Criterio: el chrome móvil flota. La barra va inset, nunca pegada a un
 * borde, con sus cuatro destinos y el activo marcado; el orbe de crear es un
 * botón aparte, no un quinto destino. Si alguien vuelve al `bottom-0
 * left-0 right-0`, falla aquí antes que en una captura.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderMobile } from "@/shared/testing/render";
import { BottomNav } from "./BottomNav";

vi.mock("next/navigation", async () => {
  const mock = (await import("@/shared/testing/navigation")).navigationMock();
  return { ...mock, usePathname: () => "/tasks" };
});

describe("BottomNav", () => {
  it("flota inset con cuatro destinos y el orbe aparte", () => {
    renderMobile(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(nav.className).toContain("inset-x-[0.9rem]");
    expect(nav.className).not.toMatch(/\b(left-0|right-0|bottom-0)\b/);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Tareas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Nueva tarea" }).className).toContain("rounded-full");
  });
});
