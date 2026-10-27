/**
 * Criterio: `useIsMobile` responde bien en el primer render. Antes arrancaba
 * en `false` y cambiaba en un efecto, así que un teléfono pintaba primero la
 * rama de escritorio (el diálogo centrado, el sidebar) y saltaba al hidratar.
 */
import { describe, expect, it } from "vitest";
import { renderWithProviders as render } from "@/shared/testing/render";
import { useIsMobile } from "./use-mobile";

function Sonda({ vistos }: { vistos: boolean[] }) {
  vistos.push(useIsMobile());
  return null;
}

describe("useIsMobile", () => {
  it("en un teléfono es true desde el primer render", () => {
    window.innerWidth = 393;
    const vistos: boolean[] = [];
    render(<Sonda vistos={vistos} />);
    expect(vistos[0]).toBe(true);
    expect(vistos.every(Boolean)).toBe(true);
  });

  it("en escritorio es false desde el primer render", () => {
    window.innerWidth = 1440;
    const vistos: boolean[] = [];
    render(<Sonda vistos={vistos} />);
    expect(vistos[0]).toBe(false);
  });
});
