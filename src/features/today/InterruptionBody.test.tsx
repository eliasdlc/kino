/**
 * Criterio: la línea del lunes pinta la cita como palabras de Elias y no como
 * un resumen más, dice cuándo no hay ninguna que citar, y marca la que viene
 * recortada. La cita es la mitad del criterio de muerte del diario, así que lo
 * que se prueba es que no se pueda confundir con texto del producto.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterruptionBody } from "./InterruptionBody";

const RESUMEN = "8 sesiones en 4 días, sobre kino y ConoceRD.";

describe("InterruptionBody", () => {
  it("pinta la cita entrecomillada y el resumen detrás", () => {
    const cita = "Quiero que la firma del cierre viva en el servicio y no en el router";
    const { container } = render(<InterruptionBody summary={RESUMEN} quote={cita} />);
    const q = container.querySelector("q");
    expect(q).toHaveTextContent(cita);
    expect(screen.getByText(new RegExp(RESUMEN.slice(0, 20)))).toBeVisible();
  });

  it("sin cita lo dice, en vez de dejar el resumen solo y fingir que no falta nada", () => {
    const { container } = render(<InterruptionBody summary={RESUMEN} quote="" />);
    expect(container.querySelector("q")).toBeNull();
    expect(screen.getByText("Sin ninguna frase que citar de esa semana.")).toBeVisible();
  });

  it("una cita recortada se marca como recortada", () => {
    const larga = `${"y sigue ".repeat(40)}`.slice(0, 279) + "…";
    render(<InterruptionBody summary={RESUMEN} quote={larga} />);
    expect(screen.getByText("(recortada)")).toBeVisible();
  });

  it("una cita que cabe entera no se marca", () => {
    render(<InterruptionBody summary={RESUMEN} quote="Una frase corta y completa" />);
    expect(screen.queryByText("(recortada)")).toBeNull();
  });
});
