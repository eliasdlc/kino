import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * KIN-92. Al pasar de `ILIKE` a full-text se reescribe entero el `WHERE` de las
 * tres queries, y la regresión peligrosa de esa reescritura no rompe ningún test
 * funcional: perder el filtro por `user_id` deja que la búsqueda de un usuario
 * devuelva contenido de otro, y perder el de `deleted_at` resucita lo borrado.
 * Aquí se renderiza el SQL que emite Drizzle y se comprueba que siguen ahí, más
 * que la consulta apoya en la columna indexada y no en una expresión al vuelo.
 *
 * La semántica contra datos reales — encontrar por contenido, ranking título vs
 * cuerpo, variantes morfológicas, acentos, aislamiento por usuario y limpieza
 * del HTML — se verificó aparte contra Neon con datos sembrados, siguiendo la
 * convención del repo para lo que necesita base (ver `reorder.sql.test.ts`).
 */

const captured = vi.hoisted(
  () => [] as Array<{ sql: string; params: unknown[] }>,
);

vi.mock("@/shared/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    db: drizzle(async (sql, params) => {
      captured.push({ sql, params });
      return { rows: [] };
    }),
  };
});

const { searchAll } = await import("./search.service");

const USER_ID = "7b3c1d2e-4f5a-4b6c-8d9e-0a1b2c3d4e5f";

/** Las tres queries salen en paralelo: tareas, páginas, sistemas. */
function queryFor(table: string) {
  const found = captured.find((q) => q.sql.includes(`from "${table}"`));
  if (!found) throw new Error(`no se emitió query sobre ${table}`);
  return found;
}

beforeEach(() => {
  captured.length = 0;
});

describe("searchAll · SQL emitido", () => {
  it("consulta las tres tablas", async () => {
    await searchAll(USER_ID, "cancion");

    expect(captured).toHaveLength(3);
    expect(() => queryFor("tasks")).not.toThrow();
    expect(() => queryFor("pages")).not.toThrow();
    expect(() => queryFor("systems")).not.toThrow();
  });

  it.each(["tasks", "pages", "systems"])(
    "conserva el scope por user_id en %s",
    async (table) => {
      await searchAll(USER_ID, "cancion");
      const { sql, params } = queryFor(table);

      expect(sql).toContain('"user_id"');
      expect(params).toContain(USER_ID);
    },
  );

  it.each(["tasks", "pages"])(
    "conserva la exclusión de lo borrado en %s",
    async (table) => {
      await searchAll(USER_ID, "cancion");

      expect(queryFor(table).sql).toMatch(/"deleted_at"\s+is null/i);
    },
  );

  it("no filtra systems por deleted_at, porque no tiene soft delete", async () => {
    await searchAll(USER_ID, "cancion");

    expect(queryFor("systems").sql).not.toContain("deleted_at");
  });

  it.each(["tasks", "pages"])(
    "casa contra la columna indexada search_vector en %s",
    async (table) => {
      await searchAll(USER_ID, "cancion");

      expect(queryFor(table).sql).toContain(`"${table}".search_vector @@`);
    },
  );

  it.each(["tasks", "pages"])("ordena por relevancia en %s", async (table) => {
    await searchAll(USER_ID, "cancion");

    expect(queryFor(table).sql).toMatch(/order by ts_rank\(.+\) desc/i);
  });

  it("usa la misma configuración de búsqueda que generó la columna", async () => {
    await searchAll(USER_ID, "cancion");

    for (const q of captured) {
      expect(q.sql).toContain("'public.spanish_unaccent'");
    }
  });

  it("busca por prefijo, que es lo que hace útil el palette mientras escribes", async () => {
    await searchAll(USER_ID, "esc");

    expect(queryFor("pages").params).toContain("esc:*");
  });

  it("pide el fragmento del cuerpo, no del HTML crudo", async () => {
    await searchAll(USER_ID, "cancion");
    const { sql } = queryFor("pages");

    expect(sql).toContain("ts_headline");
    expect(sql).toContain("regexp_replace");
  });

  it("limita el número de resultados por tipo", async () => {
    await searchAll(USER_ID, "cancion", 5);

    for (const q of captured) expect(q.params).toContain(5);
  });

  it("con un término más corto que el mínimo no toca la base", async () => {
    await searchAll(USER_ID, "a");

    expect(captured).toHaveLength(0);
  });

  // `to_tsquery('')` es un error en Postgres, no una consulta que no encuentra
  // nada: si esto se cuela, la búsqueda revienta en vez de devolver vacío.
  it("con un término sin letras ni dígitos no toca la base", async () => {
    await searchAll(USER_ID, "!!!");

    expect(captured).toHaveLength(0);
  });
});
