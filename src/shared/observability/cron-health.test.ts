import { describe, expect, it } from "vitest";
import {
  CRON_JOBS,
  findStaleCrons,
  formatSilence,
  type LastSuccess,
} from "./cron-health";

/**
 * Que la ausencia de un cron se note (KIN-166).
 *
 * Lo que el ticket pide comprobar es "desactivar a propósito el disparador
 * externo y ver que la ausencia se detecta". Aquí eso se hace moviendo el reloj
 * en vez de esperar dos horas: la regla es pura y recibe el `now`, así que el
 * escenario real —el cron externo dejó de dispararse anoche— se reproduce
 * entero y en un milisegundo.
 */

const AHORA = new Date("2026-08-27T12:00:00Z").getTime();
const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

/** Todos al día, que es el estado normal. */
function todoBien(): LastSuccess[] {
  return [
    { job: "daily-snapshot", at: new Date(AHORA - 3 * HORA) },
    { job: "task-reminders", at: new Date(AHORA - 10 * MINUTO) },
    { job: "blob-sweep", at: new Date(AHORA - 5 * HORA) },
  ];
}

describe("findStaleCrons", () => {
  it("no avisa de nada cuando los tres corrieron hace poco", () => {
    expect(findStaleCrons(todoBien(), AHORA)).toEqual([]);
  });

  it("detecta que el cron externo de recordatorios dejó de dispararse", () => {
    const ultimas = todoBien().map((entrada) =>
      entrada.job === "task-reminders" ? { ...entrada, at: new Date(AHORA - 3 * HORA) } : entrada,
    );

    const stale = findStaleCrons(ultimas, AHORA);
    expect(stale).toHaveLength(1);
    expect(stale[0]!.job).toBe("task-reminders");
    expect(stale[0]!.trigger).toBe("externo");
    expect(stale[0]!.reason).toContain("3 horas");
  });

  it("aguanta una vuelta perdida sin gritar, que es lo que la hace creíble", () => {
    // Media hora es dos vueltas de quince minutos: red que falla, no cron roto.
    const ultimas = todoBien().map((entrada) =>
      entrada.job === "task-reminders" ? { ...entrada, at: new Date(AHORA - 30 * MINUTO) } : entrada,
    );
    expect(findStaleCrons(ultimas, AHORA)).toEqual([]);
  });

  it("no haber corrido nunca cuenta como ausencia, no como 'aún no sabemos'", () => {
    // El caso de un cron externo que nadie llegó a configurar, o que alguien
    // borró del panel: el más silencioso de todos.
    const ultimas: LastSuccess[] = [
      { job: "daily-snapshot", at: new Date(AHORA - HORA) },
      { job: "task-reminders", at: null },
      { job: "blob-sweep", at: new Date(AHORA - HORA) },
    ];

    const stale = findStaleCrons(ultimas, AHORA);
    expect(stale).toHaveLength(1);
    expect(stale[0]!.reason).toContain("nunca");
    expect(stale[0]!.silentForMs).toBeNull();
  });

  it("un job que la consulta ni devuelve también se considera ausente", () => {
    expect(findStaleCrons([], AHORA)).toHaveLength(3);
  });

  it("cada job tiene su propio umbral: dos horas de silencio no tocan al diario", () => {
    const ultimas: LastSuccess[] = [
      { job: "daily-snapshot", at: new Date(AHORA - 3 * HORA) },
      { job: "task-reminders", at: new Date(AHORA - 3 * HORA) },
      { job: "blob-sweep", at: new Date(AHORA - 3 * HORA) },
    ];

    expect(findStaleCrons(ultimas, AHORA).map((cron) => cron.job)).toEqual(["task-reminders"]);
  });

  it("el diario también se vigila, aunque lo dispare Vercel", () => {
    const ultimas: LastSuccess[] = [
      { job: "daily-snapshot", at: new Date(AHORA - 72 * HORA) },
      { job: "task-reminders", at: new Date(AHORA - MINUTO) },
      { job: "blob-sweep", at: new Date(AHORA - HORA) },
    ];

    const stale = findStaleCrons(ultimas, AHORA);
    expect(stale.map((cron) => cron.job)).toEqual(["daily-snapshot"]);
    expect(stale[0]!.trigger).toBe("vercel");
  });

  it("el aviso dice qué job, cada cuánto debería correr y quién lo dispara", () => {
    // Sin esas tres cosas, quien lo lea no sabe ni dónde mirar.
    const stale = findStaleCrons([], AHORA);
    const reminders = stale.find((cron) => cron.job === "task-reminders")!;

    expect(reminders.reason).toContain("task-reminders");
    expect(reminders.reason).toContain("cada 15 minutos");
    expect(reminders.reason).toContain("externo");
  });
});

describe("formatSilence", () => {
  it("habla en la unidad que se entiende de un vistazo", () => {
    expect(formatSilence(45 * MINUTO)).toBe("45 minutos");
    expect(formatSilence(HORA)).toBe("1 hora");
    expect(formatSilence(5 * HORA)).toBe("5 horas");
    expect(formatSilence(72 * HORA)).toBe("3 días");
  });

  it("nunca dice cero minutos", () => {
    expect(formatSilence(1000)).toBe("1 minutos");
  });
});

describe("los umbrales", () => {
  it("cada job tolera varias vueltas perdidas antes de avisar", () => {
    // La regla que hace que las alertas signifiquen algo: si saltara a la
    // primera, se acabaría silenciando y daría igual tenerlas.
    expect(CRON_JOBS["task-reminders"].maxSilenceMs).toBeGreaterThan(4 * 15 * MINUTO);
    expect(CRON_JOBS["blob-sweep"].maxSilenceMs).toBeGreaterThan(24 * HORA);
    expect(CRON_JOBS["daily-snapshot"].maxSilenceMs).toBeGreaterThan(24 * HORA);
  });
});
