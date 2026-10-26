/**
 * Criterio: el pie del teléfono es papel con cinco palabras y el orbe aparte.
 * La activa es la única en ámbar y lleva el punto; Buscar abre la paleta y
 * el orbe el diálogo de nueva tarea; y con el teclado abierto el pie se
 * retira, porque si no flota encima del campo que se está escribiendo. Si
 * alguien vuelve al vidrio o a los iconos, falla aquí antes que en la captura.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("a 320 px «Sistemas» y «Bandeja» quedan con un hueco visible, contando el rem de 17 px", () => {
    renderMobile(<BottomNav />);

    // jsdom no maqueta: se calcula el ancho de columna desde las clases del
    // pie y el rem de `globals.css`. Con 16 px de rem «Sistemas» cabía; con
    // 17 px el orbe, el margen y el hueco crecen un 6 % y la palabra no.
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const rem = Number(/html\s*\{\s*font-size:\s*(\d+)px/.exec(css)?.[1]);
    expect(rem).toBeGreaterThan(0);
    const base = (el: Element) => el.className.split(/\s+/).filter((c) => !c.includes(":"));
    const px = (clases: string[], prefijo: string) => {
      const clase = clases.find((c) => c.startsWith(`${prefijo}-`));
      return clase ? Number(clase.slice(prefijo.length + 1)) * 0.25 * rem : 0;
    };

    const nav = screen.getByRole("navigation", { name: "Secciones" });
    const orbe = Number(/_(\d+(?:\.\d+)?)rem\]/.exec(nav.className)?.[1]) * rem;
    const columna = (320 - 2 * px(base(nav), "px") - px(base(nav), "gap") - orbe) / 5;

    // Trazo medido en una captura a 393 px (12,75 px, sin tracking); el
    // tracking de debajo de 360 px lo aprieta 0,025 em por letra.
    const tracking = base(nav.firstElementChild!).includes("tracking-tight") ? 0.025 * 0.75 * rem : 0;
    const trazo = (medido: number, letras: number) => medido - letras * tracking;
    const hueco = (columna - trazo(54.5, 8)) / 2 + (columna - trazo(45.5, 7)) / 2;
    expect(hueco).toBeGreaterThanOrEqual(6);
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
