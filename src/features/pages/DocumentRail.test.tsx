import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { DocumentRail, tickScale } from "./DocumentRail";
import type { OutlineItem } from "./mediums/outline";

/**
 * Criterio: en reposo todas las marcas son iguales, y la lupa del puntero
 * agranda la de debajo y menos a sus vecinas según se alejan. Eso es lo que
 * hace apuntable una raya de tres píxeles. Si la lupa no decreciera, o si una
 * marca naciera más ancha que otra, estos tests se ponen rojos.
 */

function heading(pos: number, label: string, depth = 0): OutlineItem {
  return { pos, label, depth, kind: "heading", preview: null };
}

const APUNTE = [
  heading(0, "Análisis léxico"),
  heading(40, "Autómatas finitos", 1),
  heading(90, "AFD contra AFND", 2),
  heading(140, "Expresiones regulares", 1),
  heading(200, "Tabla de símbolos", 1),
];

const CON_CUERPO: OutlineItem[] = [
  { ...heading(0, "Análisis léxico"), preview: "El lexer convierte una ristra de caracteres en tokens con su categoría." },
  { ...heading(40, "Autómatas finitos", 1), preview: null },
];

/** La escala horizontal que lleva puesta cada marca, en orden. */
function escalas(): number[] {
  return screen.getAllByTestId("rail-tick").map((tick) => {
    const found = /scaleX\(([\d.]+)\)/.exec(tick.style.transform);
    if (!found) throw new Error(`La marca no lleva scaleX: "${tick.style.transform}"`);
    return Number(found[1]);
  });
}

describe("tickScale", () => {
  it("la marca bajo el puntero llega al ancho completo", () => {
    expect(tickScale(0)).toBe(1);
  });

  it("las vecinas crecen menos cuanto más lejos están", () => {
    expect(tickScale(1)).toBeLessThan(tickScale(0));
    expect(tickScale(2)).toBeLessThan(tickScale(1));
    expect(tickScale(3)).toBeLessThan(tickScale(2));
  });

  it("a partir de la tercera todas valen lo mismo: el reposo", () => {
    expect(tickScale(4)).toBe(tickScale(3));
    expect(tickScale(9)).toBe(tickScale(3));
  });
});

describe("DocumentRail", () => {
  it("pinta una marca por título, y en reposo todas miden lo mismo", () => {
    renderWithProviders(<DocumentRail items={APUNTE} onJump={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(new Set(escalas()).size).toBe(1);
  });

  it("no se pinta cuando el documento tiene un solo título", () => {
    renderWithProviders(<DocumentRail items={[heading(0, "Análisis léxico")]} onJump={vi.fn()} />);

    expect(screen.queryByTestId("document-rail")).not.toBeInTheDocument();
  });

  it("el puntero agranda la marca de debajo y decrece hacia los lados", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={APUNTE} onJump={vi.fn()} />);

    await user.hover(screen.getByRole("button", { name: "AFD contra AFND" }));

    const [a, b, c, d, e] = escalas();
    expect(c).toBe(1);
    expect(b).toBe(d);
    expect(b).toBeLessThan(c);
    expect(a).toBeLessThan(b);
    expect(e).toBeLessThan(d);
  });

  it("Enter sobre una marca enfocada salta a la posición de su título", async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={APUNTE} onJump={onJump} />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Autómatas finitos" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onJump).toHaveBeenCalledExactlyOnceWith(40);
  });

  it("enfocar una marca enseña de qué habla su sección, sin ir a verla", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={CON_CUERPO} onJump={vi.fn()} />);

    expect(screen.queryByTestId("rail-card")).not.toBeInTheDocument();

    await user.tab();
    const tarjeta = screen.getByTestId("rail-card");
    expect(tarjeta).toHaveTextContent("Análisis léxico");
    expect(tarjeta).toHaveTextContent(/El lexer convierte una ristra de caracteres/);
  });

  it("una sección sin cuerpo enseña la tarjeta con el título y nada debajo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={CON_CUERPO} onJump={vi.fn()} />);

    await user.tab();
    await user.tab();
    const tarjeta = screen.getByTestId("rail-card");
    expect(tarjeta).toHaveTextContent("Autómatas finitos");
    expect(tarjeta.childElementCount).toBe(1);
  });

  it("solo hay una tarjeta abierta a la vez", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={CON_CUERPO} onJump={vi.fn()} />);

    await user.tab();
    await user.tab();
    expect(screen.getAllByTestId("rail-card")).toHaveLength(1);
  });
});
