import { afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { userToday, userDayRange, sqlUserDay, sqlUserToday } from "./index";

afterEach(() => {
  vi.useRealTimers();
});

describe("userToday", () => {
  it("da el día local, no el UTC, en tz negativa", () => {
    // 2026-07-04 01:00 UTC = 2026-07-03 21:00 en Santo Domingo (UTC-4).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T01:00:00Z"));
    expect(userToday("America/Santo_Domingo")).toBe("2026-07-03");
    expect(userToday("UTC")).toBe("2026-07-04");
  });
});

describe("userDayRange", () => {
  it("el día local arranca a la medianoche LOCAL, no a la medianoche UTC (el bug)", () => {
    // "Ahora" = 2026-07-03 18:00 local Santo Domingo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T22:00:00Z"));

    const { start, end } = userDayRange("America/Santo_Domingo");

    // Medianoche local del 3 jul en UTC-4 = 2026-07-03 04:00 UTC.
    // El código viejo daba 2026-07-03 00:00 UTC (medianoche UTC), 4h temprano.
    expect(start.toISOString()).toBe("2026-07-03T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-04T04:00:00.000Z");

    // Una tarea completada a las 21:00 LOCAL del día ANTERIOR (2 jul) cae en
    // 2026-07-03 01:00 UTC. NO debe contar contra hoy (3 jul). Con el umbral
    // viejo (00:00 UTC) sí contaba: ese es exactamente el bug del presupuesto.
    const completedYesterday21hLocal = new Date("2026-07-03T01:00:00Z");
    expect(completedYesterday21hLocal.getTime() >= start.getTime()).toBe(false);

    // Una tarea completada a las 21:00 LOCAL de hoy (3 jul) = 2026-07-04 01:00
    // UTC sí cuenta contra hoy.
    const completedToday21hLocal = new Date("2026-07-04T01:00:00Z");
    expect(completedToday21hLocal.getTime() >= start.getTime()).toBe(true);
    expect(completedToday21hLocal.getTime() < end.getTime()).toBe(true);
  });

  it("UTC: el rango es medianoche a medianoche UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T22:00:00Z"));
    const { start, end } = userDayRange("UTC");
    expect(start.toISOString()).toBe("2026-07-03T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-04T00:00:00.000Z");
  });
});

describe("sqlUserDay / sqlUserToday", () => {
  const dialect = new PgDialect();

  it("sqlUserDay produce la medianoche local como timestamptz (::timestamp intermedio, no ::timestamptz)", () => {
    const { sql: text } = dialect.sqlToQuery(sqlUserDay("America/Santo_Domingo"));
    expect(text).toContain("::date::timestamp AT TIME ZONE");
    // El bug viejo era `::date::timestamptz` (castea la fecha local como UTC).
    expect(text).not.toContain("::date::timestamptz");
  });

  it("sqlUserToday produce la fecha local (DATE)", () => {
    const { sql: text } = dialect.sqlToQuery(sqlUserToday("UTC"));
    expect(text).toContain("AT TIME ZONE");
    expect(text.trim().endsWith("::date")).toBe(true);
  });
});
