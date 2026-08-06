import { describe, expect, it } from "vitest";
import {
  joinScenes,
  listArcs,
  moveScene,
  renderSceneBreak,
  scenePreview,
  setSceneArc,
  splitScenes,
  type ChapterScenes,
} from "./plot-grid";

const BREAK = '<div data-scene-break="" class="scene-break">* * *</div>';
const breakWith = (arc: string, leading = false) =>
  renderSceneBreak(arc, leading);

describe("splitScenes", () => {
  it("un capítulo sin cortes es una sola escena sin corte", () => {
    const scenes = splitScenes("<p>Uno</p><p>Dos</p>");
    expect(scenes).toHaveLength(1);
    expect(scenes[0]!.hasBreak).toBe(false);
    expect(scenes[0]!.html).toBe("<p>Uno</p><p>Dos</p>");
  });

  it("parte por cada corte y el primero abre la segunda escena", () => {
    const scenes = splitScenes(`<p>Uno</p>${BREAK}<p>Dos</p>${BREAK}<p>Tres</p>`);
    expect(scenes.map((s) => s.html)).toEqual(["<p>Uno</p>", "<p>Dos</p>", "<p>Tres</p>"]);
    expect(scenes.map((s) => s.hasBreak)).toEqual([false, true, true]);
  });

  it("un corte al principio pertenece a la primera escena, no crea una vacía", () => {
    const scenes = splitScenes(`${breakWith("Trama A", true)}<p>Uno</p>`);
    expect(scenes).toHaveLength(1);
    expect(scenes[0]!.arc).toBe("Trama A");
    expect(scenes[0]!.leading).toBe(true);
  });

  it("lee el arco de cada corte", () => {
    const scenes = splitScenes(`<p>Uno</p>${breakWith("Trama B")}<p>Dos</p>`);
    expect(scenes.map((s) => s.arc)).toEqual([null, "Trama B"]);
  });

  it("desescapa un arco con caracteres especiales", () => {
    const html = `<p>Uno</p>${breakWith('Kael & "la Daga"')}<p>Dos</p>`;
    expect(splitScenes(html)[1]!.arc).toBe('Kael & "la Daga"');
  });

  it("un capítulo vacío no tiene escenas", () => {
    expect(splitScenes("")).toEqual([]);
    expect(splitScenes(null)).toEqual([]);
    expect(splitScenes("   ")).toEqual([]);
  });
});

describe("joinScenes", () => {
  it("recompone lo que partió", () => {
    const html = `<p>Uno</p>${BREAK}<p>Dos</p>`;
    expect(splitScenes(joinScenes(splitScenes(html))).map((s) => s.html)).toEqual([
      "<p>Uno</p>",
      "<p>Dos</p>",
    ]);
  });

  it("la primera escena sin arco no lleva separador", () => {
    const out = joinScenes(splitScenes("<p>Uno</p>"));
    expect(out).toBe("<p>Uno</p>");
  });

  it("la primera escena con arco lleva un corte guía, que no se pinta", () => {
    const chapters = setSceneArc(
      [{ chapterId: "c1", title: null, scenes: splitScenes("<p>Uno</p>") }],
      { chapterId: "c1", index: 0 },
      "Trama A",
    );
    const out = joinScenes(chapters[0]!.scenes);
    expect(out).toContain('data-leading="true"');
    expect(out).toContain('data-arc="Trama A"');
  });

  it("escapa el arco al escribirlo en el atributo", () => {
    const out = renderSceneBreak('a & b "c"', false);
    expect(out).toContain('data-arc="a &amp; b &quot;c&quot;"');
  });
});

function chapters(): ChapterScenes[] {
  return [
    {
      chapterId: "c1",
      title: "Capítulo 1",
      scenes: splitScenes(`<p>A</p>${BREAK}<p>B</p>`),
    },
    {
      chapterId: "c2",
      title: "Capítulo 2",
      scenes: splitScenes(`<p>C</p>${BREAK}<p>D</p>`),
    },
  ];
}

const bodies = (result: ChapterScenes[]) =>
  result.map((c) => c.scenes.map((s) => s.html.replace(/<\/?p>/g, "")));

describe("moveScene", () => {
  it("mueve una escena a otro capítulo", () => {
    const out = moveScene(chapters(), { chapterId: "c1", index: 1 }, { chapterId: "c2", index: 0 });
    expect(bodies(out)).toEqual([["A"], ["B", "C", "D"]]);
  });

  it("reordena dentro del mismo capítulo", () => {
    const out = moveScene(chapters(), { chapterId: "c1", index: 0 }, { chapterId: "c1", index: 2 });
    expect(bodies(out)[0]).toEqual(["B", "A"]);
  });

  it("mover una escena hacia arriba en su capítulo no la pasa de largo", () => {
    const three = [
      { chapterId: "c1", title: null, scenes: splitScenes(`<p>A</p>${BREAK}<p>B</p>${BREAK}<p>C</p>`) },
    ];
    const out = moveScene(three, { chapterId: "c1", index: 2 }, { chapterId: "c1", index: 0 });
    expect(bodies(out)[0]).toEqual(["C", "A", "B"]);
  });

  it("la escena que queda primera pierde su separador visible", () => {
    const out = moveScene(chapters(), { chapterId: "c1", index: 0 }, { chapterId: "c2", index: 0 });
    // "B" queda sola y primera en c1: sin arco, no debe arrastrar un `* * *`.
    expect(joinScenes(out[0]!.scenes)).toBe("<p>B</p>");
  });

  it("la escena que deja de ser primera gana su separador", () => {
    const out = moveScene(chapters(), { chapterId: "c2", index: 1 }, { chapterId: "c2", index: 0 });
    const html = joinScenes(out[1]!.scenes);
    // "D" pasa a primera y "C" a segunda: el corte tiene que estar antes de C.
    expect(html.indexOf("<p>D</p>")).toBeLessThan(html.indexOf("data-scene-break"));
    expect(html.indexOf("data-scene-break")).toBeLessThan(html.indexOf("<p>C</p>"));
  });

  it("mover a un capítulo vacío funciona", () => {
    const withEmpty = [
      ...chapters(),
      { chapterId: "c3", title: null, scenes: [] },
    ];
    const out = moveScene(withEmpty, { chapterId: "c1", index: 0 }, { chapterId: "c3", index: 0 });
    expect(bodies(out)[2]).toEqual(["A"]);
    expect(joinScenes(out[2]!.scenes)).toBe("<p>A</p>");
  });

  it("una referencia que no existe deja todo como estaba", () => {
    const before = chapters();
    expect(moveScene(before, { chapterId: "c1", index: 9 }, { chapterId: "c2", index: 0 })).toBe(before);
    expect(moveScene(before, { chapterId: "fantasma", index: 0 }, { chapterId: "c2", index: 0 })).toBe(before);
  });

  it("un índice destino fuera de rango se acota al final", () => {
    const out = moveScene(chapters(), { chapterId: "c1", index: 0 }, { chapterId: "c2", index: 99 });
    expect(bodies(out)[1]).toEqual(["C", "D", "A"]);
  });

  it("no se pierde ni se duplica texto al mover", () => {
    const out = moveScene(chapters(), { chapterId: "c1", index: 1 }, { chapterId: "c2", index: 1 });
    const all = out.map((c) => joinScenes(c.scenes)).join("");
    for (const letter of ["A", "B", "C", "D"]) {
      expect(all.split(`<p>${letter}</p>`)).toHaveLength(2);
    }
  });
});

describe("setSceneArc", () => {
  it("asigna el arco y lo conserva al recomponer", () => {
    const out = setSceneArc(chapters(), { chapterId: "c1", index: 1 }, "Trama A");
    const reread = splitScenes(joinScenes(out[0]!.scenes));
    expect(reread[1]!.arc).toBe("Trama A");
  });

  it("quitar el arco de la primera escena le quita también el corte guía", () => {
    const withArc = setSceneArc(chapters(), { chapterId: "c1", index: 0 }, "Trama A");
    const without = setSceneArc(withArc, { chapterId: "c1", index: 0 }, null);
    expect(joinScenes(without[0]!.scenes)).toBe(`<p>A</p>${BREAK}<p>B</p>`);
  });

  it("un arco en blanco cuenta como sin arco", () => {
    const out = setSceneArc(chapters(), { chapterId: "c1", index: 1 }, "   ");
    expect(out[0]!.scenes[1]!.arc).toBeNull();
  });

  it("una referencia inexistente no toca nada", () => {
    const before = chapters();
    const out = setSceneArc(before, { chapterId: "c1", index: 9 }, "X");
    expect(out[0]!.scenes).toBe(before[0]!.scenes);
  });
});

describe("listArcs", () => {
  it("devuelve los arcos en el orden en que aparecen al leer, sin repetir", () => {
    let out = setSceneArc(chapters(), { chapterId: "c2", index: 0 }, "Trama B");
    out = setSceneArc(out, { chapterId: "c1", index: 1 }, "Trama A");
    out = setSceneArc(out, { chapterId: "c2", index: 1 }, "Trama A");
    expect(listArcs(out)).toEqual(["Trama A", "Trama B"]);
  });

  it("una obra sin arcos devuelve una lista vacía", () => {
    expect(listArcs(chapters())).toEqual([]);
  });
});

describe("scenePreview", () => {
  it("saca el texto plano de la escena", () => {
    expect(scenePreview("<p>La <strong>niebla</strong> no levantó.</p>")).toBe(
      "La niebla no levantó.",
    );
  });

  it("recorta sin cortar a mitad de palabra y marca el corte", () => {
    const out = scenePreview("<p>" + "palabra ".repeat(40) + "</p>", 20);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
  });

  it("una escena vacía no revienta", () => {
    expect(scenePreview("")).toBe("");
    expect(scenePreview("<p></p>")).toBe("");
  });
});
