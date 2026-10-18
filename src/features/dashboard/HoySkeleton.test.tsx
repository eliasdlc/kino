/**
 * Criterio: el esqueleto de Hoy tiene la forma de Hoy. Comparte el canto con
 * la página (área segura de los lados incluida) y sus dos columnas, guarda el
 * sitio de la cota, la curva, el segmento y la pastilla a su alto real, pone
 * el plan bajo un título con hairline y filas con el círculo de 1.35rem en el
 * margen, y nada de eso se anima.
 */
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { HOY_COLUMNS, HOY_PAGE, HoySkeleton } from "./HoySkeleton";

describe("HoySkeleton", () => {
  it("usa el canto y las columnas de la página, con el área segura de los lados", () => {
    const { container } = renderWithProviders(<HoySkeleton />);
    const raiz = container.querySelector('[data-slot="hoy-skeleton"]');
    expect(raiz).toHaveAttribute("aria-busy");
    expect(raiz).toHaveClass(...HOY_PAGE.split(" "));
    expect(HOY_PAGE).toContain("pl-[max(1.25rem,env(safe-area-inset-left))]");
    expect(HOY_PAGE).toContain("pr-[max(1.25rem,env(safe-area-inset-right))]");
    expect(raiz?.firstElementChild).toHaveClass(...HOY_COLUMNS.split(" "));
  });

  it("guarda el sitio de cada bloque a su alto real", () => {
    const { container } = renderWithProviders(<HoySkeleton />);
    expect(container.querySelector('[data-slot="cota-skeleton"]')).toHaveClass("w-[5.2rem]", "h-[3.8rem]");
    expect(container.querySelector('[data-slot="curva-skeleton"]')).toHaveClass("h-12");
    expect(container.querySelector('[data-slot="segmento-skeleton"]')).toHaveClass("h-[3.35rem]");
    expect(container.querySelector('[data-slot="registrar-skeleton"]')).toHaveClass("h-[3.2rem]");
    expect(container.querySelector('[data-slot="plan-head-skeleton"]')).toHaveClass("border-b", "border-input");
    const circulos = container.querySelectorAll('[data-slot="plan-circle"]');
    expect(circulos).toHaveLength(3);
    circulos.forEach((c) => expect(c).toHaveClass("size-[1.35rem]", "rounded-full"));
  });

  it("no anima nada", () => {
    const { container } = renderWithProviders(<HoySkeleton />);
    expect(container.innerHTML).not.toMatch(/animate-|shimmer|pulse/);
  });
});
