import { describe, expect, it } from "vitest";
import { MAX_SNAPSHOTS_PER_PAGE, withDeltas } from "./snapshots";
import { snapshotsForPageQuery } from "./writing.snapshots";

function row(id: string, wordCount: number) {
  return { id, wordCount, createdAt: "2026-08-06T10:00:00Z", sessionStartedAt: null };
}

describe("withDeltas", () => {
  it("compara cada versión con la anterior, no con la siguiente", () => {
    // La lista va de la más nueva a la más vieja.
    const out = withDeltas([row("c", 1200), row("b", 900), row("a", 400)]);
    expect(out.map((s) => s.wordsDelta)).toEqual([300, 500, 400]);
  });

  it("la primera versión de todas cuenta desde cero", () => {
    expect(withDeltas([row("a", 400)])[0]!.wordsDelta).toBe(400);
  });

  it("una sesión de recorte da un delta negativo", () => {
    const out = withDeltas([row("b", 300), row("a", 800)]);
    expect(out[0]!.wordsDelta).toBe(-500);
  });

  it("una lista vacía no revienta", () => {
    expect(withDeltas([])).toEqual([]);
  });
});

describe("poda", () => {
  it("el tope es un número razonable y no infinito", () => {
    // El aviso del ticket era el coste en el free tier: si esto crece sin
    // control, una novela larga se come el almacenamiento.
    expect(MAX_SNAPSHOTS_PER_PAGE).toBeGreaterThan(0);
    expect(MAX_SNAPSHOTS_PER_PAGE).toBeLessThanOrEqual(50);
  });
});

/** Compilación a SQL sin DB — ver entities.queries.test.ts. */
describe("consulta del historial", () => {
  it("filtra por página y usuario, y ordena de la más nueva a la más vieja", () => {
    const { sql } = snapshotsForPageQuery(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ).toSQL();
    expect(sql).toContain('from "page_snapshots"');
    expect(sql).toContain('order by "page_snapshots"."created_at" desc');
    // La lista no debe arrastrar el texto de todas las versiones.
    expect(sql).not.toContain('"content"');
  });
});
