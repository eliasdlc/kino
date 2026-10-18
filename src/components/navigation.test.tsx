/**
 * Criterio: hay una sola lista de destinos. El pie del teléfono y el sidebar
 * de escritorio pintan los mismos hrefs (el sidebar además Calendario), Hoy
 * se llama Hoy en los dos y Bandeja llega a /bandeja. Si alguien vuelve a
 * escribir un destino a mano en uno de los dos, el otro lo delata.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderMobile, renderWithProviders } from "@/shared/testing/render";
import { BottomNav } from "./BottomNav";
import { SystemsSidebar } from "@/features/systems/SystemsSidebar";
import { DESTINOS, DESTINOS_MOVIL, cabeceraDe, destinoActivo } from "./navigation";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

function hrefsDe(nav: HTMLElement) {
  return within(nav)
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"));
}

describe("la lista única de navegación", () => {
  it("el pie pinta los destinos móviles y el sidebar todos, con los mismos hrefs y palabras", () => {
    renderMobile(<BottomNav />);
    const pie = hrefsDe(screen.getByRole("navigation", { name: "Secciones" }));
    expect(pie).toEqual(DESTINOS_MOVIL.map((d) => d.href));

    renderWithProviders(<SystemsSidebar cuenta={new Promise(() => {})} />);
    const sidebar = within(screen.getByRole("complementary", { name: "Navegación" })).getByRole("navigation", { name: "Secciones" });
    expect(hrefsDe(sidebar)).toEqual(DESTINOS.map((d) => d.href));
    for (const d of DESTINOS) {
      expect(within(sidebar).getByRole("link", { name: new RegExp(`^${d.label}`) })).toBeInTheDocument();
    }
  });

  it("Hoy se llama Hoy y Bandeja va a /bandeja", () => {
    expect(DESTINOS.find((d) => d.href === "/dashboard")?.label).toBe("Hoy");
    expect(DESTINOS.find((d) => d.label === "Bandeja")?.href).toBe("/bandeja");
    expect(DESTINOS.map((d) => d.label)).not.toContain("Dashboard");
  });

  it("Hoy sólo es Hoy; un sistema es Sistemas", () => {
    expect(destinoActivo("/dashboard", "/dashboard")).toBe(true);
    expect(destinoActivo("/systems", "/systems/abc/folders/x")).toBe(true);
    expect(destinoActivo("/tasks", "/tasksx")).toBe(false);
  });

  it("la cabecera sabe qué es raíz y a quién vuelve lo anidado", () => {
    expect(cabeceraDe("/tasks")).toEqual({ tipo: "raiz" });
    expect(cabeceraDe("/systems/abc")).toMatchObject({ tipo: "anidada", padreHref: "/systems", padreLabel: "Sistemas" });
    expect(cabeceraDe("/systems/abc/pages/p1")).toMatchObject({ tipo: "anidada", padreHref: "/systems/abc", systemId: "abc" });
    expect(cabeceraDe("/systems/abc/folders/f1/lectura")).toMatchObject({ padreHref: "/systems/abc/folders/f1" });
    expect(cabeceraDe("/settings")).toMatchObject({ padreHref: "/dashboard", padreLabel: "Hoy" });
  });
});
