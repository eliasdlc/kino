/**
 * Criterio: el chrome móvil flota y tiene cinco posiciones, una de ellas
 * Buscar, porque el atajo de teclado no existe en touch y sin esa posición el
 * teléfono no tenía búsqueda. El orbe de crear es un botón aparte, no una
 * sexta pestaña. Si alguien vuelve al `bottom-0 left-0 right-0`, falla aquí
 * antes que en una captura.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderMobile } from "@/shared/testing/render";
import { useCommandPaletteStore } from "@/features/command-palette/command-palette.store";
import { BottomNav } from "./BottomNav";

vi.mock("next/navigation", async () => {
  const mock = (await import("@/shared/testing/navigation")).navigationMock();
  return { ...mock, usePathname: () => "/tasks" };
});

describe("BottomNav", () => {
  it("flota inset con cinco posiciones y el orbe aparte", () => {
    renderMobile(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(nav.className).toContain("inset-x-[0.9rem]");
    expect(nav.className).not.toMatch(/\b(left-0|right-0|bottom-0)\b/);
    const posiciones = [...screen.getAllByRole("link"), screen.getByRole("button", { name: "Buscar" })];
    expect(posiciones).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Tareas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Nueva tarea" }).className).toContain("rounded-full");
  });

  it("las cinco posiciones son Hoy, Tareas, Buscar, Sistemas y Ajustes, en ese orden", () => {
    renderMobile(<BottomNav />);

    const barra = screen.getByRole("navigation", { name: "Secciones" }).firstElementChild!;
    expect([...barra.children].map((slot) => slot.textContent)).toEqual([
      "Hoy",
      "Tareas",
      "Buscar",
      "Sistemas",
      "Ajustes",
    ]);
  });

  it("ninguna posición es un affordance sin destino: Buscar abre la paleta", () => {
    renderMobile(<BottomNav />);
    expect(useCommandPaletteStore.getState().open).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(useCommandPaletteStore.getState().open).toBe(true);
    useCommandPaletteStore.getState().setOpen(false);
  });
});
