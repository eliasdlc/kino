import { describe, expect, it } from "vitest";
import { buildSuggestions, rankSuggestions } from "./engine";
import type { Suggestion, SuggestionRule } from "./types";

/**
 * El motor no sabe de escritura ni de sistemas: lo que se prueba aquí es el
 * patrón. Las reglas de cada slice se prueban en su slice, con sus señales.
 */

type Signals = { valor: number };
type Demo = Suggestion<"alta" | "baja" | "media">;

const alta: SuggestionRule<Signals, Demo> = (s) =>
  s.valor > 0 ? { kind: "alta", title: "Alta", reason: `valor ${s.valor}`, weight: 90 } : null;

const media: SuggestionRule<Signals, Demo> = (s) =>
  s.valor > 0 ? { kind: "media", title: "Media", reason: `valor ${s.valor}`, weight: 50 } : null;

const nunca: SuggestionRule<Signals, Demo> = () => null;

describe("buildSuggestions", () => {
  it("una regla que devuelve null no pinta nada", () => {
    expect(buildSuggestions({ valor: 1 }, [nunca])).toEqual([]);
  });

  it("sin señales que crucen el umbral no inventa sugerencias", () => {
    expect(buildSuggestions({ valor: 0 }, [alta, media])).toEqual([]);
  });

  it("lo de más peso va primero", () => {
    expect(buildSuggestions({ valor: 3 }, [media, alta]).map((s) => s.kind)).toEqual([
      "alta",
      "media",
    ]);
  });

  it("el tope recorta después de ordenar, así que deja lo de más peso", () => {
    const out = buildSuggestions({ valor: 3 }, [media, alta], { limit: 1 });
    expect(out.map((s) => s.kind)).toEqual(["alta"]);
  });

  it("un tope mayor que lo encontrado no rellena con huecos", () => {
    expect(buildSuggestions({ valor: 3 }, [alta], { limit: 6 })).toHaveLength(1);
  });

  it("el orden es estable entre llamadas iguales", () => {
    const kinds = () => buildSuggestions({ valor: 3 }, [media, alta, nunca]).map((s) => s.kind);
    expect(kinds()).toEqual(kinds());
  });
});

describe("rankSuggestions", () => {
  it("a igual peso desempata por kind, no por orden de llegada", () => {
    const empate: Demo[] = [
      { kind: "media", title: "M", reason: "r", weight: 10 },
      { kind: "alta", title: "A", reason: "r", weight: 10 },
      { kind: "baja", title: "B", reason: "r", weight: 10 },
    ];
    expect(rankSuggestions(empate).map((s) => s.kind)).toEqual(["alta", "baja", "media"]);
    expect(rankSuggestions([...empate].reverse()).map((s) => s.kind)).toEqual([
      "alta",
      "baja",
      "media",
    ]);
  });

  it("no toca el array que recibe", () => {
    const entrada: Demo[] = [
      { kind: "baja", title: "B", reason: "r", weight: 1 },
      { kind: "alta", title: "A", reason: "r", weight: 9 },
    ];
    rankSuggestions(entrada);
    expect(entrada.map((s) => s.kind)).toEqual(["baja", "alta"]);
  });
});

describe("el tipo", () => {
  it("una sugerencia sin razón no compila", () => {
    // @ts-expect-error `reason` es obligatorio: es lo que separa una señal de una corazonada.
    const sinRazon: Demo = { kind: "alta", title: "Alta", weight: 10 };
    expect(sinRazon.title).toBe("Alta");
  });
});
