import { describe, expect, it } from "vitest";
import {
  workBreakthroughsQuery,
  workPulseQuery,
  workSessionsQuery,
  writingActivityDaysQuery,
} from "./writing.service";
import { chapterMentionsQuery, storySearchQuery } from "./writing.story";

/**
 * Las consultas de escritura se compilan a SQL sin conectarse a la DB. Es la red
 * que atrapa una columna huérfana en el `select` — una tabla referenciada que no
 * está en el FROM ni en un JOIN: drizzle lo lanza al construir la query, un test
 * con `db` mockeado la deja pasar y la vista revienta en runtime (lección de W2).
 */
describe("consultas de sesiones de escritura", () => {
  const USER = "11111111-1111-1111-1111-111111111111";
  const SYSTEM = "22222222-2222-2222-2222-222222222222";
  const FOLDER = "33333333-3333-3333-3333-333333333333";
  const TZ = "America/Santo_Domingo";

  it("los días activos solo miran logs con page_id (una tarea no alimenta la racha)", () => {
    const { sql, params } = writingActivityDaysQuery(
      USER,
      SYSTEM,
      TZ,
      new Date("2026-01-01T00:00:00.000Z"),
    ).toSQL();

    expect(sql).toContain('from "time_logs"');
    expect(sql).toContain('"page_id" is not null');
    expect(sql).not.toContain('"tasks"');
    expect(params).toContain(TZ);
    expect(params).toContain(USER);
  });

  it("el día local se calcula con la timezone del usuario, no en UTC", () => {
    const { sql } = writingActivityDaysQuery(USER, SYSTEM, TZ, new Date()).toSQL();
    expect(sql).toContain("AT TIME ZONE");
  });

  it("el pulso por obra agrupa sobre el join a pages", () => {
    const { sql } = workPulseQuery(USER, SYSTEM).toSQL();
    expect(sql).toContain('from "time_logs"');
    expect(sql).toContain('inner join "pages"');
    expect(sql).toContain("group by");
  });

  it("las sesiones de una obra excluyen capítulos en la papelera", () => {
    const { sql, params } = workSessionsQuery(USER, FOLDER, TZ).toSQL();
    expect(sql).toContain('inner join "pages"');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain("order by");
    expect(params).toContain(FOLDER);
  });

  it("las notas eureka de la obra incluyen las de sus capítulos y las ancladas a la obra", () => {
    const { sql, params } = workBreakthroughsQuery(USER, FOLDER).toSQL();
    expect(sql).toContain('from "sticky_notes"');
    expect(sql).toContain('left join "pages"');
    expect(sql).toContain('"is_eureka"');
    expect(sql).toContain(" or ");
    // El folder entra dos veces: la nota anclada a la obra y la del capítulo.
    expect(params.filter((p) => p === FOLDER)).toHaveLength(2);
  });
});

describe("consultas de historia (MCP)", () => {
  const USER = "11111111-1111-1111-1111-111111111111";
  const SYSTEM = "22222222-2222-2222-2222-222222222222";
  const PAGE = "44444444-4444-4444-4444-444444444444";

  it("las menciones por capítulo compilan con el join a entities", () => {
    const { sql } = chapterMentionsQuery([PAGE]).toSQL();
    expect(sql).toContain('from "page_entity_mentions"');
    expect(sql).toContain('inner join "entities"');
    expect(sql).toContain('"deleted_at" is null');
  });

  it("la búsqueda de historia filtra por sistema y usuario, y trae el nombre de la obra", () => {
    const { sql, params } = storySearchQuery(USER, SYSTEM, "la daga").toSQL();
    expect(sql).toContain('from "pages"');
    expect(sql).toContain('left join "folders"');
    expect(sql).toContain("ilike");
    expect(params).toContain("%la daga%");
    expect(params).toContain(USER);
  });

  it("escapa los comodines del término: buscar «50%» no busca cualquier cosa", () => {
    const { params } = storySearchQuery(USER, SYSTEM, "50% del_plan").toSQL();
    expect(params).toContain("%50\\% del\\_plan%");
  });
});
