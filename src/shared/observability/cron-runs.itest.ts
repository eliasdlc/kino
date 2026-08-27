import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/shared/db";
import { cronRuns } from "@/shared/db/schema";
import {
  lastSuccessfulRuns,
  pruneOldCronRuns,
  withCronRun,
} from "./cron-runs";

/**
 * La bitácora de crons contra Postgres de verdad (KIN-166).
 *
 * Lo que se afirma aquí es lo que la vigilancia necesita para funcionar: que
 * cada ejecución deja rastro, que una que revienta se distingue de una que fue
 * bien, y que "la última vez que esto terminó bien" se puede responder. La regla
 * de cuándo avisar se prueba aparte, sin base, en `cron-health.test.ts`.
 */

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${cronRuns}`);
});

describe("withCronRun", () => {
  it("deja constancia de una ejecución que fue bien, con lo que devolvió", async () => {
    const result = await withCronRun("task-reminders", async () => ({ sent: 3, skipped: 1 }));

    expect(result).toEqual({ sent: 3, skipped: 1 });

    const [fila] = await db.select().from(cronRuns);
    expect(fila!.job).toBe("task-reminders");
    expect(fila!.ok).toBe(true);
    expect(fila!.error).toBeNull();
    expect(fila!.finishedAt).not.toBeNull();
    expect(fila!.result).toEqual({ sent: 3, skipped: 1 });
  });

  it("anota el fallo y relanza, para que quien dispara vea el 500", async () => {
    await expect(
      withCronRun("blob-sweep", async () => {
        throw new Error("el blob no responde");
      }),
    ).rejects.toThrow("el blob no responde");

    const [fila] = await db.select().from(cronRuns);
    expect(fila!.ok).toBe(false);
    expect(fila!.error).toBe("el blob no responde");
    // Cerrada igualmente: una fila sin `finishedAt` significa otra cosa.
    expect(fila!.finishedAt).not.toBeNull();
  });

  it("una ejecución que revienta no cuenta como la última buena", async () => {
    await withCronRun("task-reminders", async () => ({ sent: 1 }));
    await expect(
      withCronRun("task-reminders", async () => {
        throw new Error("caída");
      }),
    ).rejects.toThrow();

    const ultimas = await lastSuccessfulRuns();
    const reminders = ultimas.find((entrada) => entrada.job === "task-reminders")!;

    // La buena, no la de después: si el fallo contara, un cron roto que sigue
    // siendo disparado parecería sano para siempre.
    expect(reminders.at).not.toBeNull();
    const [buena] = await db.select().from(cronRuns).where(sql`${cronRuns.ok} = true`);
    expect(reminders.at!.getTime()).toBe(buena!.finishedAt!.getTime());
  });
});

describe("lastSuccessfulRuns", () => {
  it("devuelve los tres jobs aunque ninguno haya corrido", async () => {
    const ultimas = await lastSuccessfulRuns();

    expect(ultimas.map((entrada) => entrada.job).sort()).toEqual([
      "blob-sweep",
      "daily-snapshot",
      "task-reminders",
    ]);
    expect(ultimas.every((entrada) => entrada.at === null)).toBe(true);
  });

  it("no mezcla jobs: correr uno no marca a los otros como vivos", async () => {
    await withCronRun("daily-snapshot", async () => ({ users: 1 }));

    const ultimas = await lastSuccessfulRuns();
    expect(ultimas.find((entrada) => entrada.job === "daily-snapshot")!.at).not.toBeNull();
    expect(ultimas.find((entrada) => entrada.job === "task-reminders")!.at).toBeNull();
  });

  it("se queda con la más reciente cuando hay varias", async () => {
    await withCronRun("task-reminders", async () => ({ sent: 1 }));
    await withCronRun("task-reminders", async () => ({ sent: 2 }));

    const filas = await db.select().from(cronRuns);
    expect(filas).toHaveLength(2);

    const ultima = await lastSuccessfulRuns();
    const reminders = ultima.find((entrada) => entrada.job === "task-reminders")!;
    const masReciente = Math.max(...filas.map((fila) => fila.finishedAt!.getTime()));
    expect(reminders.at!.getTime()).toBe(masReciente);
  });
});

describe("pruneOldCronRuns", () => {
  it("borra lo viejo y deja lo que la vigilancia todavía consulta", async () => {
    await withCronRun("task-reminders", async () => ({ sent: 1 }));
    await db.insert(cronRuns).values({
      job: "task-reminders",
      startedAt: sql`now() - interval '45 days'` as never,
      ok: true,
    });

    expect(await pruneOldCronRuns()).toBe(1);

    const quedan = await db.select().from(cronRuns);
    expect(quedan).toHaveLength(1);
    expect(await lastSuccessfulRuns()).toContainEqual(
      expect.objectContaining({ job: "task-reminders", at: expect.any(Date) }),
    );
  });
});
