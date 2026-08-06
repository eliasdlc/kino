import { describe, expect, it } from "vitest";
import { DEFAULT_CHEKHOV } from "./chekhov";
import {
  resolveChekhovSettings,
  systemMentionTotalsQuery,
  workAppearancesQuery,
} from "./writing.chekhov";

/**
 * Las queries se compilan a SQL sin tocar la DB — la única red que atrapa una
 * columna huérfana (ver entities.queries.test.ts).
 */
describe("consultas del detector de hilos", () => {
  const SYSTEM = "11111111-1111-1111-1111-111111111111";
  const USER = "22222222-2222-2222-2222-222222222222";

  it("los totales del sistema compilan con el join a pages y el group by", () => {
    const { sql } = systemMentionTotalsQuery(SYSTEM, USER).toSQL();
    expect(sql).toContain('from "page_entity_mentions"');
    expect(sql).toContain('inner join "pages"');
    expect(sql).toContain("group by");
  });

  it("las apariciones de la obra solo tocan page_entity_mentions", () => {
    const { sql, params } = workAppearancesQuery(["c1", "c2"]).toSQL();
    expect(sql).toContain('from "page_entity_mentions"');
    expect(sql).not.toContain('"pages"');
    expect(params).toEqual(["c1", "c2"]);
  });
});

describe("resolveChekhovSettings", () => {
  it("sin configuración usa los umbrales conservadores", () => {
    expect(resolveChekhovSettings(undefined)).toEqual(DEFAULT_CHEKHOV);
    expect(resolveChekhovSettings(null)).toEqual(DEFAULT_CHEKHOV);
  });

  it("respeta lo que el usuario configuró", () => {
    expect(resolveChekhovSettings({ maxMentions: 5, minSilentChapters: 8 })).toEqual({
      maxMentions: 5,
      minSilentChapters: 8,
    });
  });

  it("acota los valores fuera de rango en vez de confiar en el jsonb", () => {
    // metadata es jsonb: puede traer cualquier cosa escrita por una versión vieja
    // o por el MCP. Un 0 aquí apagaría el detector sin decirlo.
    expect(resolveChekhovSettings({ maxMentions: 0, minSilentChapters: 9999 })).toEqual({
      maxMentions: 1,
      minSilentChapters: 50,
    });
  });

  it("cae al default campo a campo cuando el valor no es un número", () => {
    expect(
      resolveChekhovSettings({ maxMentions: "muchas", minSilentChapters: 4 }),
    ).toEqual({ maxMentions: DEFAULT_CHEKHOV.maxMentions, minSilentChapters: 4 });
    expect(resolveChekhovSettings({ maxMentions: Number.NaN })).toEqual(DEFAULT_CHEKHOV);
  });

  it("redondea los decimales: el umbral se cuenta en enteros", () => {
    expect(resolveChekhovSettings({ maxMentions: 2.6 }).maxMentions).toBe(3);
  });
});
