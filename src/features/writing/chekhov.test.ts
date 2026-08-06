import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHEKHOV,
  detectLooseThreads,
  threadSummary,
  type DetectInput,
  type ThreadAppearance,
  type ThreadEntity,
} from "./chekhov";

const CHAPTERS = [
  { id: "c1", title: "Capítulo 1" },
  { id: "c2", title: "Capítulo 2" },
  { id: "c3", title: "Capítulo 3" },
  { id: "c4", title: "Capítulo 4" },
  { id: "c5", title: "Capítulo 5" },
];

function entity(id: string, over: Partial<ThreadEntity> = {}): ThreadEntity {
  return {
    id,
    name: id,
    type: "object",
    mentionsInSystem: 0,
    threadResolvedMentions: null,
    ...over,
  };
}

function seen(entityId: string, pageId: string, mentionCount = 1): ThreadAppearance {
  return { entityId, pageId, mentionCount };
}

function run(input: Partial<DetectInput> & Pick<DetectInput, "appearances" | "entities">) {
  return detectLooseThreads({
    chapters: CHAPTERS,
    settings: DEFAULT_CHEKHOV,
    ...input,
  });
}

describe("detectLooseThreads", () => {
  it("señala lo que se nombró poco y hace mucho", () => {
    const threads = run({
      entities: [entity("daga", { name: "La Daga" })],
      appearances: [seen("daga", "c2", 2)],
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]!.name).toBe("La Daga");
    expect(threads[0]!.lastChapter.index).toBe(2);
    expect(threads[0]!.silentChapters).toBe(3);
  });

  it("no señala lo que sigue apareciendo", () => {
    const threads = run({
      entities: [entity("kael")],
      appearances: [seen("kael", "c1"), seen("kael", "c5")],
    });
    expect(threads).toEqual([]);
  });

  it("no señala lo que se nombra mucho aunque lleve capítulos callado", () => {
    // Un protagonista ausente del último acto no es un cabo suelto olvidado.
    const threads = run({
      entities: [entity("kael")],
      appearances: [seen("kael", "c1", 40)],
    });
    expect(threads).toEqual([]);
  });

  it("no señala lo que apareció hace poco aunque sea de fondo", () => {
    const threads = run({
      entities: [entity("posadero")],
      appearances: [seen("posadero", "c4", 1)],
    });
    expect(threads).toEqual([]);
  });

  it("una entidad del codex que no sale en esta obra no es hilo de esta obra", () => {
    const threads = run({
      entities: [entity("de-otra-novela")],
      appearances: [],
    });
    expect(threads).toEqual([]);
  });

  it("ignora apariciones en capítulos de otra obra", () => {
    const threads = run({
      entities: [entity("daga")],
      appearances: [seen("daga", "c2"), seen("daga", "capitulo-ajeno", 50)],
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]!.totalMentions).toBe(1);
  });

  it("suma las menciones de todos sus capítulos", () => {
    const threads = run({
      entities: [entity("daga")],
      appearances: [seen("daga", "c1", 1), seen("daga", "c2", 2)],
    });
    expect(threads[0]!.totalMentions).toBe(3);
    expect(threads[0]!.chapterCount).toBe(2);
    expect(threads[0]!.firstChapter.index).toBe(1);
    expect(threads[0]!.lastChapter.index).toBe(2);
  });

  it("una obra sin capítulos no produce hallazgos", () => {
    expect(
      detectLooseThreads({
        chapters: [],
        entities: [entity("daga")],
        appearances: [seen("daga", "c1")],
        settings: DEFAULT_CHEKHOV,
      }),
    ).toEqual([]);
  });

  it("los umbrales mandan sobre el criterio", () => {
    const appearances = [seen("daga", "c4", 1)];
    const entities = [entity("daga")];
    expect(run({ entities, appearances })).toEqual([]);
    const laxo = detectLooseThreads({
      chapters: CHAPTERS,
      entities,
      appearances,
      settings: { maxMentions: 3, minSilentChapters: 1 },
    });
    expect(laxo).toHaveLength(1);
  });

  it("ordena lo más olvidado primero y desempata por nombre", () => {
    const threads = run({
      entities: [entity("b", { name: "Bruma" }), entity("a", { name: "Ámbar" }), entity("z", { name: "Zafiro" })],
      appearances: [seen("b", "c1"), seen("a", "c1"), seen("z", "c2")],
    });
    expect(threads.map((t) => t.name)).toEqual(["Ámbar", "Bruma", "Zafiro"]);
  });
});

describe("hilos cerrados a mano", () => {
  it("un hilo cerrado sigue en la lista pero marcado como resuelto", () => {
    const threads = run({
      entities: [entity("daga", { mentionsInSystem: 2, threadResolvedMentions: 2 })],
      appearances: [seen("daga", "c2", 2)],
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]!.resolved).toBe(true);
    expect(threads[0]!.reopened).toBe(false);
  });

  it("se reabre solo cuando la entidad vuelve a nombrarse", () => {
    // Se cerró con 2 menciones; el universo ya va por 3: el autor lo retomó.
    const threads = run({
      entities: [entity("daga", { mentionsInSystem: 3, threadResolvedMentions: 2 })],
      appearances: [seen("daga", "c2", 2)],
    });
    expect(threads[0]!.resolved).toBe(false);
    expect(threads[0]!.reopened).toBe(true);
  });

  it("se reabre aunque la mención nueva esté en otra obra del mismo universo", () => {
    // La comparación es contra el sistema entero, que es el ámbito con el que se
    // cerró: retomar la Daga en otra novela también es retomar el hilo.
    const threads = run({
      entities: [entity("daga", { mentionsInSystem: 9, threadResolvedMentions: 2 })],
      appearances: [seen("daga", "c2", 2)],
    });
    expect(threads[0]!.reopened).toBe(true);
  });

  it("recortar texto no reabre un hilo cerrado", () => {
    const threads = run({
      entities: [entity("daga", { mentionsInSystem: 1, threadResolvedMentions: 5 })],
      appearances: [seen("daga", "c2", 1)],
    });
    expect(threads[0]!.resolved).toBe(true);
    expect(threads[0]!.reopened).toBe(false);
  });

  it("cerrar con cero menciones registradas es válido", () => {
    const threads = run({
      entities: [entity("daga", { mentionsInSystem: 1, threadResolvedMentions: 0 })],
      appearances: [seen("daga", "c2", 1)],
    });
    expect(threads[0]!.reopened).toBe(true);
  });
});

describe("threadSummary", () => {
  it("nombra el capítulo concreto para poder ir a verificarlo", () => {
    const [thread] = run({
      entities: [entity("daga", { name: "La Daga" })],
      appearances: [seen("daga", "c2")],
    });
    expect(threadSummary(thread!)).toBe(
      "Apareció por última vez en «Capítulo 2» y no ha vuelto en 3 capítulos.",
    );
  });

  it("cae al número cuando el capítulo no tiene título", () => {
    const [thread] = detectLooseThreads({
      chapters: [{ id: "c1", title: null }, { id: "c2", title: "  " }, { id: "c3", title: null }],
      entities: [entity("daga")],
      appearances: [seen("daga", "c1")],
      settings: { maxMentions: 3, minSilentChapters: 2 },
    });
    expect(threadSummary(thread!)).toContain("el capítulo 1");
  });

  it("usa el singular cuando solo pasó un capítulo", () => {
    const [thread] = detectLooseThreads({
      chapters: CHAPTERS,
      entities: [entity("daga")],
      appearances: [seen("daga", "c4")],
      settings: { maxMentions: 3, minSilentChapters: 1 },
    });
    expect(threadSummary(thread!)).toContain("no ha vuelto en el capítulo siguiente");
  });
});
