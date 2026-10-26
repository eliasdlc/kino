/**
 * Criterio: el pie del teléfono es papel con cinco palabras y el orbe aparte.
 * La activa es la única en ámbar y lleva el punto; Buscar abre la paleta y
 * el orbe el diálogo de nueva tarea; y con el teclado abierto el pie se
 * retira, porque si no flota encima del campo que se está escribiendo. Si
 * alguien vuelve al vidrio o a los iconos, falla aquí antes que en la captura.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderMobile } from "@/shared/testing/render";
import { useCommandPaletteStore } from "@/features/command-palette/command-palette.store";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { BottomNav } from "./BottomNav";

vi.mock("next/navigation", async () => {
  const mock = (await import("@/shared/testing/navigation")).navigationMock();
  return { ...mock, usePathname: () => "/tasks" };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BottomNav", () => {
  it("es papel con hairline y cinco palabras sin icono, y el orbe aparte", () => {
    renderMobile(<BottomNav />);

    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(nav.className).toContain("border-t");
    expect(nav.className).not.toMatch(/glass|backdrop-blur/);
    expect(nav.querySelectorAll("a svg")).toHaveLength(0);
    const palabras = [...nav.firstElementChild!.children].map((el) => el.textContent);
    expect(palabras).toEqual(["Hoy", "Tareas", "Sistemas", "Bandeja", "Buscar"]);
    expect(screen.getByRole("button", { name: "Nueva tarea" }).className).toContain("rounded-full");
  });

  it("a 320 px las cinco columnas reparten el ancho a partes iguales y la del orbe queda reservada", () => {
    renderMobile(<BottomNav />);

    // Sin `minmax(0,1fr)` una columna crece hasta su palabra (`auto` mínimo)
    // y «Sistemas» se come el hueco de sus vecinas. jsdom no mide: se fija la
    // estructura que garantiza el reparto.
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(nav.className).toContain("grid-cols-[minmax(0,1fr)_2.85rem]");
    const palabras = nav.firstElementChild!;
    expect(palabras.className).toContain("grid-cols-[repeat(5,minmax(0,1fr))]");
    for (const palabra of palabras.children) expect(palabra.className).toContain("min-w-0");
    expect(screen.getByRole("button", { name: "Nueva tarea" }).className).toContain("size-[2.85rem]");
  });

  it("la palabra activa es la única en ámbar y lleva el punto", () => {
    renderMobile(<BottomNav />);

    const activa = screen.getByRole("link", { name: "Tareas" });
    expect(activa).toHaveAttribute("aria-current", "page");
    expect(activa.className).toContain("text-primary");
    expect(activa.querySelector("[data-slot=punto]")).not.toBeNull();
    for (const otra of ["Hoy", "Sistemas", "Bandeja"]) {
      const link = screen.getByRole("link", { name: otra });
      expect(link).not.toHaveAttribute("aria-current");
      expect(link.className).not.toContain("text-primary");
      expect(link.querySelector("[data-slot=punto]")).toBeNull();
    }
  });

  it("dentro de un sistema, Sistemas sigue activa", () => {
    renderMobile(<BottomNav rutaActual="/systems/abc/folders/def" />);
    expect(screen.getByRole("link", { name: "Sistemas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Hoy" })).not.toHaveAttribute("aria-current");
  });

  it("Bandeja llega a su propia URL y suma el área segura", () => {
    renderMobile(<BottomNav />);
    expect(screen.getByRole("link", { name: "Bandeja" })).toHaveAttribute("href", "/bandeja");
    expect(screen.getByRole("navigation", { name: "Secciones" }).className).toContain("safe-area-inset-bottom");
  });

  it("Buscar abre la paleta y el orbe abre nueva tarea", () => {
    renderMobile(<BottomNav />);
    useCommandPaletteStore.getState().setOpen(false);
    useQuickAddStore.getState().setOpen(false);

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(useCommandPaletteStore.getState().open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    expect(useQuickAddStore.getState().open).toBe(true);

    useCommandPaletteStore.getState().setOpen(false);
    useQuickAddStore.getState().setOpen(false);
  });

  it("se retira mientras un campo tiene el foco con puntero grueso, y vuelve al soltarlo", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({ matches: query === "(pointer: coarse)", media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
    );
    renderMobile(
      <>
        <input aria-label="Título" />
        <BottomNav />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();

    act(() => {
      screen.getByLabelText("Título").focus();
    });
    expect(screen.queryByRole("navigation", { name: "Secciones" })).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--kino-bottom-chrome")).toBe("0px");

    act(() => {
      screen.getByLabelText("Título").blur();
    });
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--kino-bottom-chrome")).toBe("");
  });

  it("con puntero fino el foco en un campo no lo retira: no hay teclado que tape nada", () => {
    renderMobile(
      <>
        <input aria-label="Título" />
        <BottomNav />
      </>,
    );
    act(() => {
      screen.getByLabelText("Título").focus();
    });
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
  });

  it("se retira cuando el viewport visual encoge como un teclado, no como las barras del navegador", () => {
    const viewport = Object.assign(new EventTarget(), { height: 852 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    window.innerHeight = 852;
    renderMobile(<BottomNav />);
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();

    act(() => {
      viewport.height = 790;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();

    act(() => {
      viewport.height = 520;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByRole("navigation", { name: "Secciones" })).toBeNull();

    act(() => {
      viewport.height = 852;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  });
});
