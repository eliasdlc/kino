import { describe, expect, it } from "vitest";
import { buildSuggestions, type StudioSignals } from "./studio";

function signals(over: Partial<StudioSignals> = {}): StudioSignals {
  return {
    openChapter: null,
    staleWork: null,
    wordsToday: 0,
    dailyWordGoal: null,
    peakWindow: null,
    currentHour: 10,
    looseThreadCount: 0,
    hasAnyChapter: true,
    ...over,
  };
}

const kinds = (input: StudioSignals) => buildSuggestions(input).map((s) => s.kind);

describe("buildSuggestions", () => {
  it("sin nada escrito solo propone empezar", () => {
    expect(kinds(signals({ hasAnyChapter: false }))).toEqual(["first-step"]);
  });

  it("un sistema sin señales no inventa sugerencias", () => {
    expect(buildSuggestions(signals())).toEqual([]);
  });

  it("retomar lo que quedó a medias va primero", () => {
    const out = buildSuggestions(
      signals({
        openChapter: {
          pageId: "p1",
          title: "La niebla",
          folderName: "La marea baja",
          wordCount: 1200,
          daysSinceEdit: 1,
        },
        looseThreadCount: 3,
        dailyWordGoal: 1000,
      }),
    );
    expect(out[0]!.kind).toBe("resume-chapter");
    expect(out[0]!.target).toEqual({ kind: "page", id: "p1" });
  });

  it("cada sugerencia trae su porqué comprobable", () => {
    // Números por debajo del millar: el separador depende del ICU del entorno y
    // lo que se prueba aquí es que la razón cite el dato, no cómo se formatea.
    const out = buildSuggestions(signals({ dailyWordGoal: 800, wordsToday: 400 }));
    expect(out[0]!.reason).toContain("400");
    expect(out[0]!.reason).toContain("800");
  });

  it("una obra parada solo se señala pasado el umbral", () => {
    const dos = signals({ staleWork: { folderId: "f1", name: "Obra", daysSinceLastSession: 2 } });
    expect(kinds(dos)).not.toContain("stale-work");
    const cinco = signals({ staleWork: { folderId: "f1", name: "Obra", daysSinceLastSession: 5 } });
    expect(kinds(cinco)).toContain("stale-work");
  });

  it("cuanto más parada, más arriba", () => {
    const poco = buildSuggestions(
      signals({ staleWork: { folderId: "f", name: "O", daysSinceLastSession: 3 } }),
    )[0]!;
    const mucho = buildSuggestions(
      signals({ staleWork: { folderId: "f", name: "O", daysSinceLastSession: 20 } }),
    )[0]!;
    expect(mucho.weight).toBeGreaterThan(poco.weight);
  });

  it("la meta cumplida se celebra en vez de exigir más", () => {
    const out = buildSuggestions(signals({ dailyWordGoal: 500, wordsToday: 900 }));
    expect(out[0]!.title).toContain("cumplida");
  });

  it("sin meta configurada no habla de metas", () => {
    expect(kinds(signals({ wordsToday: 300 }))).not.toContain("daily-goal");
  });

  it("estar dentro de la ventana creativa sube su prioridad", () => {
    const dentro = buildSuggestions(
      signals({ peakWindow: { start: 9, end: 11 }, currentHour: 10 }),
    )[0]!;
    const fuera = buildSuggestions(
      signals({ peakWindow: { start: 9, end: 11 }, currentHour: 18 }),
    )[0]!;
    expect(dentro.weight).toBeGreaterThan(fuera.weight);
    expect(dentro.title).toContain("Estás dentro");
    expect(fuera.title).toContain("09h");
  });

  it("los hilos sueltos se cuentan en singular y en plural", () => {
    expect(buildSuggestions(signals({ looseThreadCount: 1 }))[0]!.title).toContain("1 hilo suelto");
    expect(buildSuggestions(signals({ looseThreadCount: 4 }))[0]!.title).toContain("4 hilos sueltos");
  });

  it("el orden es estable entre llamadas iguales", () => {
    const input = signals({
      openChapter: { pageId: "p", title: null, folderName: "O", wordCount: 10, daysSinceEdit: 0 },
      dailyWordGoal: 100,
      looseThreadCount: 2,
      peakWindow: { start: 9, end: 11 },
    });
    expect(kinds(input)).toEqual(kinds(input));
  });
});
