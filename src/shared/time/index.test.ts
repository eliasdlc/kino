import { afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { userToday, userDayRange, sqlUserDay, sqlUserToday, zonedDayHourToUtc } from "./index";

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

describe("zonedDayHourToUtc", () => {
  it("las 9 del usuario son las 9 del usuario, no las 9 UTC", () => {
    // Bloquear "9am" en Santo Domingo (UTC-4) = 13:00 UTC. Guardarlo como 09:00
    // UTC lo pondría a las 5 de la mañana del usuario: el bug que este helper evita.
    const at9 = zonedDayHourToUtc("2026-07-03", 9, "America/Santo_Domingo");
    expect(at9.toISOString()).toBe("2026-07-03T13:00:00.000Z");

    expect(zonedDayHourToUtc("2026-07-03", 9, "UTC").toISOString()).toBe(
      "2026-07-03T09:00:00.000Z",
    );
  });

  it("una hora de la noche en tz negativa cae al día siguiente en UTC, sin correr el día local", () => {
    const at22 = zonedDayHourToUtc("2026-07-03", 22, "America/Santo_Domingo");
    expect(at22.toISOString()).toBe("2026-07-04T02:00:00.000Z");
  });

  it("respeta el offset vigente de la zona en esa fecha (DST)", () => {
    // Madrid: UTC+1 en enero, UTC+2 en julio. La misma hora local da distinto UTC.
    expect(zonedDayHourToUtc("2026-01-15", 9, "Europe/Madrid").toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    expect(zonedDayHourToUtc("2026-07-15", 9, "Europe/Madrid").toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  it("acota la hora al rango 0–23 en vez de desbordar el día", () => {
    expect(zonedDayHourToUtc("2026-07-03", 30, "UTC").toISOString()).toBe(
      "2026-07-03T23:00:00.000Z",
    );
    expect(zonedDayHourToUtc("2026-07-03", -5, "UTC").toISOString()).toBe(
      "2026-07-03T00:00:00.000Z",
    );
  });

  it("la medianoche local coincide con el inicio del rango del día", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T22:00:00Z"));
    const { start } = userDayRange("America/Santo_Domingo");
    expect(zonedDayHourToUtc("2026-07-03", 0, "America/Santo_Domingo").toISOString()).toBe(
      start.toISOString(),
    );
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
