import { describe, expect, it } from "vitest";
import { closingSummary } from "./closing-summary";

// El cierre nombra primero lo que la persona arregló con sus palabras, y no
// inventa partes vacías: una pasada que sólo se descartó no dice «arreglaste 0».

const cero = { edited: 0, applied: 0, marked: 0, verified: 0, dismissed: 0 };

describe("closingSummary", () => {
  it("empieza por lo que arreglaste tú y junta el resto", () => {
    expect(closingSummary({ closedHow: { ...cero, edited: 3, applied: 1, dismissed: 2 } })).toBe(
      "Arreglaste 3 con tus palabras, aplicaste 1 propuesta y descartaste 2.",
    );
  });

  it("no nombra lo que no pasó", () => {
    expect(closingSummary({ closedHow: { ...cero, dismissed: 1 } })).toBe("Descartaste 1.");
    expect(closingSummary({ closedHow: cero })).toBe("");
  });
});
