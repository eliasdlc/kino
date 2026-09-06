/**
 * Qué se prueba: que la primitiva de esqueleto no anima si el sistema pide
 * menos movimiento. De ella cuelgan los doce `loading.tsx` de la app, así que
 * un `animate-pulse` suelto aquí es un latido en cada pantalla que carga.
 *
 * El apagado lo hace CSS (`motion-safe:` y el bloque global de `globals.css`),
 * que jsdom no evalúa. Lo que sí se puede comprobar, y es la regresión real,
 * es que la clase de animación nunca sale sin su prefijo.
 */

import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { Skeleton } from "./skeleton";

function clases(el: HTMLElement): string[] {
  return [...el.classList];
}

describe("Skeleton", () => {
  it("su animación va detrás de motion-safe, nunca suelta", () => {
    const { container } = renderWithProviders(<Skeleton />);
    const skeleton = container.querySelector<HTMLElement>('[data-slot="skeleton"]');

    expect(skeleton).not.toBeNull();
    expect(skeleton!).toHaveClass("motion-safe:animate-pulse");
    expect(clases(skeleton!).filter((c) => c.startsWith("animate-"))).toEqual([]);
  });

  it("una clase que le pasen encima no cuela una animación sin prefijo", () => {
    const { container } = renderWithProviders(<Skeleton className="h-4 w-32" />);
    const skeleton = container.querySelector<HTMLElement>('[data-slot="skeleton"]');

    expect(skeleton!).toHaveClass("h-4", "w-32", "motion-safe:animate-pulse");
    expect(clases(skeleton!).filter((c) => c.startsWith("animate-"))).toEqual([]);
  });
});
