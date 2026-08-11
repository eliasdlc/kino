import { describe, expect, it } from "vitest";
import { insertIndexFor, splitScenes, type ChapterScenes } from "./plot-grid";
import { plotChaptersQuery } from "./writing.plot";

const BREAK = '<div data-scene-break="" class="scene-break">* * *</div>';

function chapters(): ChapterScenes[] {
  return [
    { chapterId: "c1", title: null, scenes: splitScenes(`<p>A</p>${BREAK}<p>B</p>${BREAK}<p>C</p>`) },
    { chapterId: "c2", title: null, scenes: splitScenes(`<p>D</p>`) },
  ];
}

describe("insertIndexFor", () => {
  it("moviendo hacia abajo en el mismo capítulo descuenta el hueco que deja", () => {
    expect(insertIndexFor(chapters(), { chapterId: "c1", index: 0 }, { chapterId: "c1", index: 2 })).toBe(1);
  });

  it("moviendo hacia arriba no descuenta nada", () => {
    expect(insertIndexFor(chapters(), { chapterId: "c1", index: 2 }, { chapterId: "c1", index: 0 })).toBe(0);
  });

  it("a otro capítulo, el índice es el pedido", () => {
    expect(insertIndexFor(chapters(), { chapterId: "c1", index: 0 }, { chapterId: "c2", index: 1 })).toBe(1);
  });

  it("acota al final del capítulo destino", () => {
    expect(insertIndexFor(chapters(), { chapterId: "c1", index: 0 }, { chapterId: "c2", index: 99 })).toBe(1);
  });

  it("nunca devuelve un índice negativo", () => {
    expect(
      insertIndexFor(
        [{ chapterId: "c1", title: null, scenes: [] }],
        { chapterId: "c1", index: 0 },
        { chapterId: "c1", index: 0 },
      ),
    ).toBe(0);
  });
});

/** Compilación a SQL sin DB — ver entities.queries.test.ts. */
describe("consulta del tablero", () => {
  it("trae los capítulos vivos con su contenido, en orden de obra", () => {
    const { sql } = plotChaptersQuery(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ).toSQL();
    expect(sql).toContain('from "pages"');
    expect(sql).toContain('"content"');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('order by "pages"."created_at" asc');
  });
});
