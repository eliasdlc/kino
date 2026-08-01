import { describe, expect, it } from "vitest";
import {
  buildJournal,
  computeStreak,
  milestoneLabel,
  previousDay,
} from "./writing.streak";
import type { WritingSession } from "./writing.types";

function session(
  day: string,
  words: number,
  extra: Partial<WritingSession> = {},
): WritingSession & { day: string } {
  return {
    id: `${day}-${words}`,
    pageId: "page-1",
    pageTitle: "Cap. 1",
    folderId: "obra-1",
    startedAt: `${day}T10:00:00.000Z`,
    endedAt: `${day}T10:30:00.000Z`,
    durationMinutes: 30,
    wordsWritten: words,
    day,
    ...extra,
  };
}

describe("previousDay", () => {
  it("retrocede un día dentro del mes", () => {
    expect(previousDay("2026-08-02")).toBe("2026-08-01");
  });

  it("cruza el borde de mes y de año", () => {
    expect(previousDay("2026-08-01")).toBe("2026-07-31");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });

  it("respeta el 29 de febrero de un bisiesto", () => {
    expect(previousDay("2028-03-01")).toBe("2028-02-29");
  });
});

describe("computeStreak", () => {
  it("cuenta los días consecutivos hasta hoy", () => {
    const days = ["2026-08-01", "2026-07-31", "2026-07-30"];
    expect(computeStreak(days, "2026-08-01")).toEqual({
      streakDays: 3,
      streakIncludesToday: true,
    });
  });

  it("sigue viva si hoy todavía no escribiste pero ayer sí", () => {
    const days = ["2026-07-31", "2026-07-30"];
    expect(computeStreak(days, "2026-08-01")).toEqual({
      streakDays: 2,
      streakIncludesToday: false,
    });
  });

  it("se rompe cuando el último día activo es anteayer", () => {
    expect(computeStreak(["2026-07-30"], "2026-08-01")).toEqual({
      streakDays: 0,
      streakIncludesToday: false,
    });
  });

  it("no cuenta dos veces un día repetido (varias sesiones el mismo día)", () => {
    const days = ["2026-08-01", "2026-08-01", "2026-07-31"];
    expect(computeStreak(days, "2026-08-01").streakDays).toBe(2);
  });

  it("sin actividad devuelve cero", () => {
    expect(computeStreak([], "2026-08-01")).toEqual({
      streakDays: 0,
      streakIncludesToday: false,
    });
  });
});

describe("buildJournal", () => {
  it("agrupa sesiones por día y devuelve el más reciente primero", () => {
    const days = buildJournal({
      sessions: [session("2026-07-30", 100), session("2026-08-01", 250), session("2026-08-01", 50)],
      completions: [],
      totalWords: 400,
      wordGoal: null,
    });

    expect(days.map((d) => d.day)).toEqual(["2026-08-01", "2026-07-30"]);
    expect(days[0]!.words).toBe(300);
    expect(days[0]!.sessions).toHaveLength(2);
    expect(days[0]!.minutes).toBe(60);
  });

  it("acumula sobre la línea base: el texto anterior a W4 no cuenta como escrito hoy", () => {
    // La obra tiene 5.000 palabras pero solo 300 registradas en sesiones.
    const days = buildJournal({
      sessions: [session("2026-07-30", 100), session("2026-08-01", 200)],
      completions: [],
      totalWords: 5_000,
      wordGoal: null,
    });

    const ascending = [...days].reverse();
    expect(ascending[0]!.cumulativeWords).toBe(4_800);
    expect(ascending[1]!.cumulativeWords).toBe(5_000);
  });

  it("marca el día exacto en que se cruzó la meta, y solo ese", () => {
    const days = buildJournal({
      sessions: [session("2026-07-30", 400), session("2026-07-31", 400), session("2026-08-01", 400)],
      completions: [],
      totalWords: 1_200,
      wordGoal: 1_000,
    });

    const crossed = days.filter((d) =>
      d.milestones.some((m) => m.kind === "goal-reached"),
    );
    expect(crossed).toHaveLength(1);
    expect(crossed[0]!.day).toBe("2026-08-01");
  });

  it("no repite el hito de meta si la obra ya nació por encima de ella", () => {
    const days = buildJournal({
      sessions: [session("2026-08-01", 10)],
      completions: [],
      totalWords: 90_000,
      wordGoal: 1_000,
    });
    expect(days[0]!.milestones).toEqual([]);
  });

  it("registra los capítulos terminados como hito de su día", () => {
    const days = buildJournal({
      sessions: [session("2026-08-01", 10)],
      completions: [{ pageId: "p1", pageTitle: "El puente", day: "2026-08-01" }],
      totalWords: 10,
      wordGoal: null,
    });

    expect(days[0]!.milestones).toEqual([
      { kind: "chapter-completed", pageId: "p1", pageTitle: "El puente" },
    ]);
  });

  it("crea un día para un capítulo terminado aunque ese día no hubo sesión", () => {
    const days = buildJournal({
      sessions: [session("2026-07-25", 100)],
      completions: [{ pageId: "p1", pageTitle: "El puente", day: "2026-08-01" }],
      totalWords: 100,
      wordGoal: null,
    });

    expect(days.map((d) => d.day)).toEqual(["2026-08-01", "2026-07-25"]);
    expect(days[0]!.sessions).toHaveLength(0);
  });

  it("recoge las notas eureka como hito de su día, aunque no hubo sesión", () => {
    const days = buildJournal({
      sessions: [],
      completions: [],
      breakthroughs: [{ noteId: "n1", text: "Kael y Dahl son hermanos", day: "2026-08-01" }],
      totalWords: 0,
      wordGoal: null,
    });

    expect(days).toHaveLength(1);
    expect(days[0]!.milestones).toEqual([
      { kind: "breakthrough", noteId: "n1", text: "Kael y Dahl son hermanos" },
    ]);
  });

  it("celebra la racha de 7 días en el día que se alcanza", () => {
    const week = [
      "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29",
      "2026-07-30", "2026-07-31", "2026-08-01",
    ];
    const days = buildJournal({
      sessions: week.map((d) => session(d, 100)),
      completions: [],
      totalWords: 700,
      wordGoal: null,
    });

    const streakDays = days.filter((d) => d.milestones.some((m) => m.kind === "streak"));
    expect(streakDays).toHaveLength(1);
    expect(streakDays[0]!.day).toBe("2026-08-01");
  });

  it("un hueco reinicia la cuenta de la racha", () => {
    const withGap = [
      "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23",
      "2026-07-24", "2026-07-25",
      // falta el 26
      "2026-07-27",
    ];
    const days = buildJournal({
      sessions: withGap.map((d) => session(d, 100)),
      completions: [],
      totalWords: 700,
      wordGoal: null,
    });

    expect(days.some((d) => d.milestones.some((m) => m.kind === "streak"))).toBe(false);
  });

  it("un día en el que solo se recortó texto suma un delta negativo", () => {
    const days = buildJournal({
      sessions: [session("2026-08-01", -320)],
      completions: [],
      totalWords: 680,
      wordGoal: null,
    });
    expect(days[0]!.words).toBe(-320);
    expect(days[0]!.cumulativeWords).toBe(680);
  });
});

describe("milestoneLabel", () => {
  it("nombra cada tipo de hito sin emojis", () => {
    expect(milestoneLabel({ kind: "streak", days: 7 })).toBe("Racha de 7 días escribiendo");
    expect(milestoneLabel({ kind: "goal-reached", goal: 90000 })).toContain("90.000");
    expect(
      milestoneLabel({ kind: "chapter-completed", pageId: "p", pageTitle: null }),
    ).toBe("Terminaste «Sin título»");
    expect(milestoneLabel({ kind: "breakthrough", noteId: "n", text: "La daga es de Dahl" })).toBe(
      "La daga es de Dahl",
    );
  });
});
