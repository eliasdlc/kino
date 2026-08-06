import { describe, expect, it } from "vitest";
import { manuscriptChaptersQuery } from "./writing.manuscript";

/** Compilación a SQL sin DB — ver entities.queries.test.ts. */
describe("consulta del manuscrito", () => {
  const FOLDER = "11111111-1111-1111-1111-111111111111";
  const USER = "22222222-2222-2222-2222-222222222222";

  it("trae los capítulos vivos de la obra en orden de creación", () => {
    const { sql } = manuscriptChaptersQuery(FOLDER, USER).toSQL();
    expect(sql).toContain('from "pages"');
    expect(sql).toContain('"deleted_at" is null');
    // El orden de lectura de una obra es el de creación en todo el Writing System.
    expect(sql).toContain('order by "pages"."created_at" asc');
  });
});
