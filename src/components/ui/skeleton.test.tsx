/**
 * Qué se prueba: que la primitiva de esqueleto no anima, nunca. De ella
 * cuelgan los doce `loading.tsx` de la app, así que un `animate-pulse` aquí
 * es un latido en cada pantalla que carga, y la identidad no admite ninguna
 * animación en bucle. Lo que se comprueba es que ninguna clase de animación
 * sale de la primitiva, con o sin prefijo.
 */

import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { Skeleton } from "./skeleton";

function clases(el: HTMLElement): string[] {
  return [...el.classList];
}

describe("Skeleton", () => {
  it("no lleva ninguna animación", () => {
    const { container } = renderWithProviders(<Skeleton />);
    const skeleton = container.querySelector<HTMLElement>('[data-slot="skeleton"]');

    expect(skeleton).not.toBeNull();
    expect(clases(skeleton!).filter((c) => c.includes("animate-"))).toEqual([]);
  });

  it("conserva las clases que le pasan y sigue sin animar", () => {
    const { container } = renderWithProviders(<Skeleton className="h-4 w-32" />);
    const skeleton = container.querySelector<HTMLElement>('[data-slot="skeleton"]');

    expect(skeleton!).toHaveClass("h-4", "w-32", "bg-muted");
    expect(clases(skeleton!).filter((c) => c.includes("animate-"))).toEqual([]);
  });
});
