import { describe, expect, it } from "vitest";
import type { Loose } from "@/shared/convex/loose";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import {
  END_HOUR,
  HOURS,
  ROW_HEIGHT,
  START_HOUR,
  TOTAL_HEIGHT,
  blockGeometry,
  dayKey,
  energyBgClass,
  getPlacementDate,
  groupTasksByDay,
  minutesToTimeString,
  occupiedHoursForDay,
  parseEstimatedMinutes,
  resizedMinutes,
  slotTop,
  suggestHour,
} from "./calendar.layout";

/**
 * El cálculo de la rejilla salió de GlobalCalendarView en KIN-146 justamente
 * para poder cubrirlo: antes vivía dentro del componente y no había forma de
 * probar dónde cae un bloque sin montar el calendario entero.
 */

function task(partial: Partial<Loose<TaskTransport>>): TaskTransport {
  return { id: "t", title: "Tarea", ...partial } as TaskTransport;
}

describe("constantes de la rejilla", () => {
  it("cubre de START_HOUR a END_HOUR, ambas incluidas", () => {
    expect(HOURS[0]).toBe(START_HOUR);
    expect(HOURS.at(-1)).toBe(END_HOUR);
    expect(HOURS).toHaveLength(END_HOUR - START_HOUR + 1);
  });

  it("el alto total es una fila por hora", () => {
    expect(TOTAL_HEIGHT).toBe(HOURS.length * ROW_HEIGHT);
  });
});

describe("parseEstimatedMinutes", () => {
  it("interpreta HH:MM", () => {
    expect(parseEstimatedMinutes("01:30")).toBe(90);
    expect(parseEstimatedMinutes("00:15")).toBe(15);
    expect(parseEstimatedMinutes("02:00")).toBe(120);
  });

  it("cae en 60 minutos cuando no hay estimación", () => {
    expect(parseEstimatedMinutes(null)).toBe(60);
    expect(parseEstimatedMinutes(undefined)).toBe(60);
    expect(parseEstimatedMinutes("")).toBe(60);
  });

  it("tolera un valor sin minutos", () => {
    expect(parseEstimatedMinutes("02")).toBe(120);
  });
});

describe("minutesToTimeString", () => {
  it("formatea con cero a la izquierda", () => {
    expect(minutesToTimeString(90)).toBe("01:30");
    expect(minutesToTimeString(15)).toBe("00:15");
    expect(minutesToTimeString(600)).toBe("10:00");
  });

  it("es la inversa de parseEstimatedMinutes", () => {
    for (const m of [15, 45, 60, 135, 480]) {
      expect(parseEstimatedMinutes(minutesToTimeString(m))).toBe(m);
    }
  });
});

describe("blockGeometry", () => {
  it("ubica una tarea a la altura de su hora", () => {
    const { top } = blockGeometry(new Date(2026, 0, 5, START_HOUR, 0), 60);
    expect(top).toBe(0);
  });

  it("desplaza proporcionalmente los minutos", () => {
    const { top } = blockGeometry(new Date(2026, 0, 5, START_HOUR + 2, 30), 60);
    expect(top).toBe(2.5 * ROW_HEIGHT);
  });

  it("el alto es proporcional a la duración", () => {
    expect(blockGeometry(new Date(2026, 0, 5, 10, 0), 120).height).toBe(2 * ROW_HEIGHT);
    expect(blockGeometry(new Date(2026, 0, 5, 10, 0), 30).height).toBe(0.5 * ROW_HEIGHT);
  });

  it("nunca baja del alto mínimo legible, aunque la tarea dure 5 minutos", () => {
    expect(blockGeometry(new Date(2026, 0, 5, 10, 0), 5).height).toBe(24);
  });
});

describe("slotTop", () => {
  it("apila las horas de arriba abajo desde START_HOUR", () => {
    expect(slotTop(START_HOUR)).toBe(0);
    expect(slotTop(START_HOUR + 1)).toBe(ROW_HEIGHT);
    expect(slotTop(END_HOUR)).toBe((END_HOUR - START_HOUR) * ROW_HEIGHT);
  });
});

describe("resizedMinutes", () => {
  it("no cambia nada si no hubo arrastre", () => {
    expect(resizedMinutes(60, 0)).toBe(60);
  });

  it("ajusta a cuartos de hora", () => {
    // Media fila = 30 min exactos.
    expect(resizedMinutes(60, ROW_HEIGHT / 2)).toBe(90);
    // Un arrastre pequeño se redondea al cuarto más cercano.
    expect(resizedMinutes(60, 4)).toBe(60);
    expect(resizedMinutes(60, ROW_HEIGHT / 4)).toBe(75);
  });

  it("permite acortar arrastrando hacia arriba", () => {
    expect(resizedMinutes(120, -ROW_HEIGHT)).toBe(60);
  });

  it("nunca baja de un cuarto de hora, por mucho que arrastres hacia arriba", () => {
    expect(resizedMinutes(60, -ROW_HEIGHT * 10)).toBe(15);
  });
});

describe("energyBgClass", () => {
  it("hecho arriba de 60, acento en el medio, vencida abajo de 30", () => {
    expect(energyBgClass(80)).toContain("task-done");
    expect(energyBgClass(60)).toContain("task-done");
    expect(energyBgClass(45)).toContain("primary");
    expect(energyBgClass(30)).toContain("primary");
    expect(energyBgClass(10)).toContain("task-overdue");
  });
});

describe("suggestHour", () => {
  const curve = Array.from({ length: 24 }, (_, h) => (h === 9 ? 90 : h === 15 ? 20 : 50));

  it("para energía alta elige el pico de la curva", () => {
    expect(suggestHour("high", curve, new Set())).toBe(9);
  });

  it("para energía baja elige el valle", () => {
    expect(suggestHour("low", curve, new Set())).toBe(15);
  });

  it("para energía media elige lo más cercano al 50%", () => {
    const hour = suggestHour("medium", curve, new Set());
    expect(hour).not.toBe(9);
    expect(hour).not.toBe(15);
    expect(curve[hour!]).toBe(50);
  });

  it("no propone una hora ya ocupada", () => {
    expect(suggestHour("high", curve, new Set([9]))).not.toBe(9);
  });

  it("devuelve null si todas las horas visibles están ocupadas", () => {
    expect(suggestHour("high", curve, new Set(HOURS))).toBeNull();
  });

  it("nunca propone fuera del rango visible de la rejilla", () => {
    const madrugada = Array.from({ length: 24 }, (_, h) => (h === 3 ? 100 : 10));
    expect(suggestHour("high", madrugada, new Set())).toBeGreaterThanOrEqual(START_HOUR);
  });
});

describe("getPlacementDate", () => {
  it("prefiere startDate cuando trae hora", () => {
    const t = task({ startDate: "2026-01-05T14:00:00.000Z", dueDate: "2026-01-06T00:00:00.000Z" });
    expect(getPlacementDate(t)).toBe("2026-01-05T14:00:00.000Z");
  });

  it("usa dueDate cuando startDate no tiene hora", () => {
    const t = task({ startDate: "2026-01-05T00:00:00.000Z", dueDate: "2026-01-06T09:00:00.000Z" });
    expect(getPlacementDate(t)).toBe("2026-01-06T09:00:00.000Z");
  });

  it("cae a startDate sin hora cuando no hay dueDate", () => {
    const t = task({ startDate: "2026-01-05T00:00:00.000Z", dueDate: null });
    expect(getPlacementDate(t)).toBe("2026-01-05T00:00:00.000Z");
  });

  it("devuelve null cuando la tarea no tiene fecha ubicable", () => {
    expect(getPlacementDate(task({ startDate: null, dueDate: null }))).toBeNull();
  });
});

describe("groupTasksByDay", () => {
  const conHora = task({ id: "a", startDate: "2026-01-05T14:30:00.000Z" });
  const otraConHora = task({ id: "b", startDate: "2026-01-05T09:00:00.000Z" });
  const todoElDia = task({ id: "c", dueDate: "2026-01-06T00:00:00.000Z" });
  const sinFecha = task({ id: "d", startDate: null, dueDate: null });

  it("separa las que tienen hora de las de todo el día", () => {
    const timed = groupTasksByDay([conHora, todoElDia, sinFecha], { timed: true });
    const allDay = groupTasksByDay([conHora, todoElDia, sinFecha], { timed: false });

    expect([...timed.values()].flat().map((t) => t.id)).toEqual(["a"]);
    expect([...allDay.values()].flat().map((t) => t.id)).toEqual(["c"]);
  });

  it("agrupa varias tareas del mismo día en el mismo bucket", () => {
    const timed = groupTasksByDay([conHora, otraConHora], { timed: true });

    expect(timed.size).toBe(1);
    expect([...timed.values()][0]).toHaveLength(2);
  });

  it("ignora las tareas sin fecha ubicable en ambos modos", () => {
    expect(groupTasksByDay([sinFecha], { timed: true }).size).toBe(0);
    expect(groupTasksByDay([sinFecha], { timed: false }).size).toBe(0);
  });

  it("usa una clave por día en formato yyyy-MM-dd", () => {
    const timed = groupTasksByDay([conHora], { timed: true });
    expect([...timed.keys()][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("occupiedHoursForDay", () => {
  it("recoge las horas de las tareas con hora de ese día", () => {
    const d = new Date(2026, 0, 5, 12, 0);
    const enEseDia = task({ startDate: new Date(2026, 0, 5, 14, 30).toISOString() });

    expect(occupiedHoursForDay([enEseDia], d)).toEqual(new Set([14]));
  });

  it("ignora las de otros días y las de todo el día", () => {
    const d = new Date(2026, 0, 5, 12, 0);
    const otroDia = task({ startDate: new Date(2026, 0, 7, 14, 0).toISOString() });
    const todoElDia = task({ dueDate: "2026-01-05T00:00:00.000Z" });

    expect(occupiedHoursForDay([otroDia, todoElDia], d).size).toBe(0);
  });
});

describe("dayKey", () => {
  it("da la misma clave para dos instantes del mismo día", () => {
    expect(dayKey(new Date(2026, 0, 5, 1, 0))).toBe(dayKey(new Date(2026, 0, 5, 23, 0)));
  });
});
