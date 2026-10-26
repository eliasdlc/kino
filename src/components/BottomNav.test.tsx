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

  it("debajo de 360 px la fila es flex con trazo apretado y desde 360 px vuelve a la rejilla de columnas iguales sin tocar margen, hueco ni tracking", () => {
    renderMobile(<BottomNav />);

    // jsdom no maqueta: se fija, clase a clase, qué cambia debajo de 360 px y
    // qué debe seguir igual desde 360 px (rejilla, hueco 1.5, margen px-2 y
    // tracking normal). Quitar cualquiera de ellas mueve el pie a 360 o más.
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    const clases = (el: Element) => new Set(el.className.split(/\s+/));
    const navClases = clases(nav);
    expect(navClases.has("grid-cols-[minmax(0,1fr)_2.85rem]")).toBe(true);
    for (const c of ["gap-1", "pl-0", "pr-2", "min-[360px]:gap-1.5", "min-[360px]:px-2"]) {
      expect(navClases.has(c), c).toBe(true);
    }

    const palabras = nav.firstElementChild!;
    const filaClases = clases(palabras);
    for (const c of [
      "justify-between",
      "tracking-tight",
      "min-[360px]:grid",
      "min-[360px]:grid-cols-[repeat(5,minmax(0,1fr))]",
      "min-[360px]:tracking-normal",
    ]) {
      expect(filaClases.has(c), c).toBe(true);
    }
    for (const palabra of palabras.children) {
      expect(palabra.className).toContain("min-w-[2.85rem]");
      expect(palabra.className).toContain("min-[360px]:min-w-0");
    }
    expect(screen.getByRole("button", { name: "Nueva tarea" }).className).toContain("size-[2.85rem]");
  });

  it("con el rem agrandado la fila de palabras se desplaza dentro de su caja en vez de montarse sobre el orbe, sin barra y sin recortar el anillo de foco", () => {
    renderMobile(<BottomNav />);

    // El orbe ocupa su columna fija; la fila de palabras es la única que
    // cede. Cada palabra conserva su tamaño (`shrink-0`) y, si la suma
    // supera la caja, la fila se desplaza en horizontal. Desde 360 px la
    // fila no recorta (`overflow-visible`) y el anillo de foco sale entero.
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    const fila = new Set(nav.firstElementChild!.className.split(/\s+/));
    for (const c of [
      "min-w-0",
      "overflow-x-auto",
      "overscroll-x-contain",
      "[scrollbar-width:none]",
      "[&::-webkit-scrollbar]:hidden",
      "min-[360px]:overflow-visible",
    ]) {
      expect(fila.has(c), c).toBe(true);
    }
    for (const palabra of nav.firstElementChild!.children) {
      expect(palabra.className).toContain("shrink-0");
      expect(palabra.className).toContain("max-[359px]:focus-visible:outline-offset-[-2px]");
    }
  });

  it("a 320 px las palabras no se tocan, Buscar queda aparte del orbe y el orbe conserva su margen derecho, contando el rem de 17 px", () => {
    renderMobile(<BottomNav />);

    // jsdom no maqueta: se calcula desde las clases del pie, el rem de
    // `globals.css` y el trazo medido en una captura a 393 px (12,75 px, sin
    // tracking). El tracking de debajo de 360 px lo aprieta 0,025 em por
    // letra, y esa `em` es la del contenedor (17 px), no la del `text-xs` de
    // las palabras: `tracking-tight` va en la fila, así que se hereda como
    // -0,425 px. Los anchos son la tinta de cada palabra en esa captura.
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
    const margenDerecho = px(base(nav), "pr");
    const hueco = px(base(nav), "gap");
    const fila = 320 - px(base(nav), "pl") - margenDerecho - hueco - orbe;

    const palabras = nav.firstElementChild!;
    for (const palabra of palabras.children) expect(palabra.className).not.toContain("tracking-");
    const tracking = base(palabras).includes("tracking-tight") ? 0.025 * rem : 0;
    const minimo = 2.85 * rem;
    const medidos: Record<string, number> = { Hoy: 23, Tareas: 40.5, Sistemas: 54.5, Bandeja: 45.5, Buscar: 40 };
    const textos = [...palabras.children].map((el) => {
      const etiqueta = el.textContent!;
      return { etiqueta, trazo: medidos[etiqueta]! - etiqueta.length * tracking };
    });
    const objetivos = textos.map((t) => Math.max(minimo, t.trazo));
    const sobrante = (fila - objetivos.reduce((a, b) => a + b, 0)) / (textos.length - 1);
    expect(sobrante).toBeGreaterThanOrEqual(0);
    const huecos = textos.slice(1).map((t, i) => {
      const previo = textos[i]!;
      return sobrante + (objetivos[i]! - previo.trazo) / 2 + (objetivos[i + 1]! - t.trazo) / 2;
    });

    const buscar = textos.length - 1;
    const buscarAlOrbe = hueco + (objetivos[buscar]! - textos[buscar]!.trazo) / 2;

    expect(Math.min(...huecos)).toBeGreaterThanOrEqual(4);
    expect(buscarAlOrbe).toBeGreaterThanOrEqual(4);
    expect(margenDerecho).toBeGreaterThanOrEqual(8);
    expect(Math.min(...objetivos)).toBeGreaterThanOrEqual(2.85 * rem);
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
