import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { DocumentRail, levelTint, planRail, tickScale } from "./DocumentRail";
import type { OutlineItem } from "./mediums/outline";

/**
 * Criterio: el carril cabe siempre en su lienzo, el brillo dice el nivel y la
 * lupa del puntero agranda la marca de debajo y menos a sus vecinas. Si el
 * carril volviera a crecer sin techo, si dos niveles se pintaran igual, o si la
 * lupa no decreciera, estos tests se ponen rojos.
 */

function heading(pos: number, label: string, depth = 0): OutlineItem {
  return { pos, label, depth, kind: "heading", preview: null };
}

/** Presupuesto de sobra: el caso normal, donde el índice cabe entero. */
const SOBRA = 600;

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

/** Un documento de clase: seis temas, cada uno con apartados y su detalle. */
function documentoLargo(): OutlineItem[] {
  const items: OutlineItem[] = [];
  let pos = 0;
  for (let tema = 0; tema < 6; tema++) {
    items.push(heading((pos += 10), `Tema ${tema + 1}`, 0));
    for (let apartado = 0; apartado < 3; apartado++) {
      items.push(heading((pos += 10), `Apartado ${apartado + 1}`, 1));
      for (let detalle = 0; detalle < 3; detalle++) {
        items.push(heading((pos += 10), `Detalle ${detalle + 1}`, 2));
      }
    }
  }
  return items;
}

function raices(cuantas: number): OutlineItem[] {
  return Array.from({ length: cuantas }, (_, i) => heading(i * 10, `Tema ${i + 1}`, 0));
}

/** La escala horizontal que lleva puesta cada marca, en orden. */
function escalas(): number[] {
  return screen.getAllByTestId("rail-tick").map((tick) => {
    const found = /scaleX\(([\d.]+)\)/.exec(tick.style.transform);
    if (!found) throw new Error(`La marca no lleva scaleX: "${tick.style.transform}"`);
    return Number(found[1]);
  });
}

describe("planRail", () => {
  it("un índice que cabe entero se pinta entero, al paso normal", () => {
    const plan = planRail(APUNTE, SOBRA);
    expect(plan?.items).toHaveLength(APUNTE.length);
    expect(plan?.pitch).toBe(12);
  });

  it("cuando no cabe suelta el nivel más profundo antes que recortarse", () => {
    const largo = documentoLargo();
    expect(largo).toHaveLength(78);

    // 588 px es el presupuesto de un lienzo de 840, el de una ventana de 900.
    const plan = planRail(largo, 588);
    expect(plan?.items).toHaveLength(24);
    expect(plan?.items.every((item) => item.depth <= 1)).toBe(true);
    expect(plan?.pitch).toBe(12);
  });

  it("si ni el primer nivel cabe al paso normal, aprieta el paso", () => {
    const plan = planRail(raices(60), 600);
    expect(plan?.items).toHaveLength(60);
    expect(plan?.pitch).toBe(10);
  });

  it("no aprieta por debajo del suelo: prefiere no pintar carril", () => {
    expect(planRail(raices(80), 600)).toBeNull();
  });

  it("sin lienzo medido todavía no hay carril", () => {
    expect(planRail(APUNTE, 0)).toBeNull();
  });

  it("un documento de un solo título no tiene carril que pintar", () => {
    expect(planRail([heading(0, "Análisis léxico")], SOBRA)).toBeNull();
  });
});

describe("levelTint", () => {
  it("cada nivel tiene su tono, y el primero es el más visible", () => {
    expect(levelTint(0)).not.toBe(levelTint(1));
    expect(levelTint(1)).not.toBe(levelTint(2));
  });

  it("más allá del último nivel se queda en el más apagado", () => {
    expect(levelTint(5)).toBe(levelTint(2));
  });
});

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
    renderWithProviders(<DocumentRail items={APUNTE} budget={SOBRA} onJump={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(new Set(escalas()).size).toBe(1);
  });

  it("el nivel se lee en el brillo, no en el ancho", () => {
    renderWithProviders(<DocumentRail items={APUNTE} budget={SOBRA} onJump={vi.fn()} />);

    const [h1, h2, h3] = screen.getAllByTestId("rail-tick");
    expect(h1.className).toContain(levelTint(0));
    expect(h2.className).toContain(levelTint(1));
    expect(h3.className).toContain(levelTint(2));
    expect(new Set(escalas()).size).toBe(1);
  });

  it("no se pinta cuando el documento tiene un solo título", () => {
    renderWithProviders(
      <DocumentRail items={[heading(0, "Análisis léxico")]} budget={SOBRA} onJump={vi.fn()} />,
    );

    expect(screen.queryByTestId("document-rail")).not.toBeInTheDocument();
  });

  it("con el lienzo lleno pinta solo los niveles que caben", () => {
    renderWithProviders(<DocumentRail items={documentoLargo()} budget={588} onJump={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(24);
  });

  it("el puntero agranda la marca de debajo y decrece hacia los lados", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={APUNTE} budget={SOBRA} onJump={vi.fn()} />);

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
    renderWithProviders(<DocumentRail items={APUNTE} budget={SOBRA} onJump={onJump} />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Autómatas finitos" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onJump).toHaveBeenCalledExactlyOnceWith(40);
  });

  it("enfocar una marca enseña de qué habla su sección, sin ir a verla", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={CON_CUERPO} budget={SOBRA} onJump={vi.fn()} />);

    expect(screen.queryByTestId("rail-card")).not.toBeInTheDocument();

    await user.tab();
    const tarjeta = screen.getByTestId("rail-card");
    expect(tarjeta).toHaveTextContent("Análisis léxico");
    expect(tarjeta).toHaveTextContent(/El lexer convierte una ristra de caracteres/);
  });

  it("una sección sin cuerpo enseña la tarjeta con el título y nada debajo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={CON_CUERPO} budget={SOBRA} onJump={vi.fn()} />);

    await user.tab();
    await user.tab();
    const tarjeta = screen.getByTestId("rail-card");
    expect(tarjeta).toHaveTextContent("Autómatas finitos");
    expect(tarjeta.childElementCount).toBe(1);
  });

  it("solo hay una tarjeta abierta a la vez", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={CON_CUERPO} budget={SOBRA} onJump={vi.fn()} />);

    await user.tab();
    await user.tab();
    expect(screen.getAllByTestId("rail-card")).toHaveLength(1);
  });
});
