import { describe, expect, it } from "vitest";
import { eventMentionsQuery, systemEventsQuery } from "./writing.timeline";

/** Compilación a SQL sin DB — ver entities.queries.test.ts. */
describe("consultas de la cronología", () => {
  const SYSTEM = "11111111-1111-1111-1111-111111111111";
  const USER = "22222222-2222-2222-2222-222222222222";

  it("los eventos del sistema filtran por tipo y por vivos", () => {
    const { sql, params } = systemEventsQuery(SYSTEM, USER).toSQL();
    expect(sql).toContain('from "entities"');
    expect(sql).toContain('"deleted_at" is null');
    expect(params).toContain("event");
  });

  it("las menciones de los eventos solo tocan page_entity_mentions", () => {
    const { sql } = eventMentionsQuery(["a", "b"]).toSQL();
    expect(sql).toContain('from "page_entity_mentions"');
    expect(sql).not.toContain('"pages"');
  });
});
