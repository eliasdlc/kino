/**
 * Criterio: la propuesta del techo enseña sus cifras con la evidencia detrás, y
 * cuando la evidencia desapareció no se pinta. Una cifra sin las filas que la
 * sostienen es una afirmación, y el producto no afirma.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CeilingProposalBody } from "./CeilingProposalBody";

const PROPUESTA = {
  cierres: 9,
  dias: 4,
  horasObservadas: 14.5,
  propuesto: 3.5,
  actual: 6,
  evidencia: ["t1", "t2", "t3"],
};

describe("CeilingProposalBody", () => {
  it("dice cuántos cierres, en cuántos días y qué techo saldría", () => {
    render(<CeilingProposalBody propuesta={PROPUESTA} />);
    expect(screen.getByText("9 cierres en 4 días")).toBeVisible();
    expect(screen.getByText(/14.5 h de trabajo observado/)).toBeVisible();
    expect(screen.getByText(/Tu techo diría 3.5 h en vez de 6 h/)).toBeVisible();
  });

  it("sin evidencia no se pinta, en vez de enseñar una cifra que ya no se sostiene", () => {
    const { container } = render(<CeilingProposalBody propuesta={{ ...PROPUESTA, evidencia: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("un solo día se dice en singular", () => {
    render(<CeilingProposalBody propuesta={{ ...PROPUESTA, cierres: 7, dias: 1 }} />);
    expect(screen.getByText("7 cierres en 1 día")).toBeVisible();
  });
});
