import { describe, expect, it } from "vitest";
import {
  appearancesForEntityQuery,
  relationsForEntityQuery,
} from "./entities.service";

/**
 * Las consultas de la ficha se compilan a SQL sin conectarse a la DB. Es la única
 * red que atrapa una columna huérfana en el `select` (una tabla referenciada que
 * no está en el FROM ni en un JOIN): drizzle lo lanza al construir la query, los
 * tests con `db` mockeado la dejan pasar y la ficha revienta en runtime.
 */
describe("consultas de la ficha de entidad", () => {
  const ENTITY = "11111111-1111-1111-1111-111111111111";

  it("la query de relaciones compila y sólo toca entity_relations", () => {
    const { sql, params } = relationsForEntityQuery(ENTITY).toSQL();
    expect(sql).toContain('from "entity_relations"');
    expect(sql).not.toContain('"entities"');
    expect(params).toEqual([ENTITY, ENTITY]);
  });

  it("la query de apariciones compila con el join a pages", () => {
    const { sql } = appearancesForEntityQuery(ENTITY).toSQL();
    expect(sql).toContain('from "page_entity_mentions"');
    expect(sql).toContain('inner join "pages"');
  });
});
