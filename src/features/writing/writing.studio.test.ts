import { describe, expect, it } from "vitest";
import { codexGapsQuery, openChapterQuery } from "./writing.studio";

/** Compilación a SQL sin DB — ver entities.queries.test.ts. */
describe("consultas del estudio", () => {
  const SYSTEM = "11111111-1111-1111-1111-111111111111";
  const USER = "22222222-2222-2222-2222-222222222222";

  it("los huecos del codex piden entidades sin ficha y ya mencionadas", () => {
    const { sql } = codexGapsQuery(SYSTEM, USER).toSQL();
    expect(sql).toContain('from "entities"');
    expect(sql).toContain('inner join "page_entity_mentions"');
    // Sin resumen y sin atributos: eso es "no tiene ni una línea escrita".
    expect(sql).toContain('"summary" is null');
    expect(sql).toContain('"attributes" is null');
    expect(sql).toContain("group by");
  });

  it("el capítulo abierto es el más reciente sin terminar", () => {
    const { sql } = openChapterQuery(SYSTEM, USER).toSQL();
    expect(sql).toContain('from "pages"');
    expect(sql).toContain('"completed_at" is null');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('order by "pages"."updated_at" desc');
  });
});
