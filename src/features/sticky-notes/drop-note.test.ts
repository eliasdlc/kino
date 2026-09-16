/**
 * Criterio: soltar una nota en un punto del cuaderno guarda la X como fracción
 * de la columna de texto y la Y como fracción del contenedor, acotada, y la
 * marca como flotante. Es el mismo cálculo venga la nota de flotar o de la
 * cuadrícula, y por eso vive aparte de las dos.
 */
import { describe, expect, it } from "vitest";
import { makeStickyNote, mid } from "@/app/system-design/mock-data";
import { dropNote } from "./drop-note";
import type { NotebookMetrics } from "./sticky-position";

const CUADERNO: NotebookMetrics = { columnLeft: 200, columnWidth: 800, containerW: 1200, containerH: 2000 };
const contenedor = document.createElement("div");

function soltar(leftPx: number, topPx: number, note = makeStickyNote({ id: mid("nota") })) {
  return dropNote({ note, editor: null, container: contenedor, metrics: CUADERNO, leftPx, topPx });
}

describe("dropNote", () => {
  it("la X es una fracción de la columna: el borde izquierdo es 0 y el derecho 1", () => {
    expect(soltar(200, 0).positionX).toBe(0);
    expect(soltar(1000, 0).positionX).toBe(1);
    expect(soltar(40, 0).positionX).toBe(-0.2);
  });

  it("la Y es una fracción del contenedor y nunca sale de [0, 1]", () => {
    expect(soltar(0, 500).positionY).toBe(0.25);
    expect(soltar(0, -50).positionY).toBe(0);
    expect(soltar(0, 9000).positionY).toBe(1);
  });

  it("la nota pasa a flotar, y sin editor no toca el ancla ni el desfase", () => {
    const guardado = soltar(300, 300);

    expect(guardado.positionSide).toBe("over");
    expect("anchorId" in guardado).toBe(false);
    expect("offsetY" in guardado).toBe(false);
  });

  it("sin medida todavía no divide por cero", () => {
    const vacio: NotebookMetrics = { columnLeft: 0, columnWidth: 0, containerW: 0, containerH: 0 };
    const guardado = dropNote({ note: makeStickyNote(), editor: null, container: contenedor, metrics: vacio, leftPx: 10, topPx: 10 });

    expect(guardado.positionX).toBe(0);
    expect(guardado.positionY).toBe(0);
  });
});
