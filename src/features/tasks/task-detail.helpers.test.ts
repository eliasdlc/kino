import { describe, expect, it } from "vitest";
import type { TaskTransport } from "./tasks.types";
import {
  buildDirtyTaskData,
  formatDuration,
  hasDueTime,
  needsGradeField,
  taskJsonFilename,
  withDay,
  withTime,
  type TaskDetailFormState,
} from "./task-detail.helpers";

/**
 * `buildDirtyTaskData` decide qué viaja al servidor en cada autosave del panel
 * de detalle. Vivía dentro de TaskDetailSheet y salió en KIN-146 (FE-05) para
 * poder cubrir sus reglas, que tienen historia: mandar `null` al limpiar una
 * fecha, y no incluir una fecha que no cambió para no resetear recordatorios.
 */

function task(partial: Partial<TaskTransport> = {}): TaskTransport {
  return {
    id: "task-1",
    title: "Original",
    description: null,
    priority: "medium",
    energyLevel: "medium",
    taskType: null,
    dueDate: null,
    startDate: null,
    folderId: null,
    sprintId: null,
    contextTagId: null,
    recurrenceRule: null,
    metadata: null,
    ...partial,
  } as TaskTransport;
}

function form(partial: Partial<TaskDetailFormState> = {}): TaskDetailFormState {
  return {
    title: "Original",
    description: "",
    priority: "medium",
    energyLevel: "medium",
    taskType: undefined,
    dueDate: undefined,
    startDate: undefined,
    selectedFolderId: "none",
    sprintId: "none",
    contextTagId: null,
    recurrenceRule: null,
    metadata: null,
    ...partial,
  } as TaskDetailFormState;
}

describe("buildDirtyTaskData · sin cambios", () => {
  it("no manda nada cuando el formulario refleja la tarea", () => {
    expect(buildDirtyTaskData(task(), form())).toEqual({});
  });

  it("ignora el espacio sobrante del título", () => {
    expect(buildDirtyTaskData(task({ title: "Leer" }), form({ title: "  Leer  " }))).toEqual({});
  });

  it("no manda una fecha que no cambió, para no resetear recordatorios en cada tecla", () => {
    const iso = "2026-03-04T15:00:00.000Z";
    const data = buildDirtyTaskData(
      task({ dueDate: iso, title: "x" }),
      form({ dueDate: new Date(iso), title: "y" }),
    );

    expect(data).toHaveProperty("title", "y");
    expect(data).not.toHaveProperty("dueDate");
  });
});

describe("buildDirtyTaskData · campos simples", () => {
  it("manda sólo lo que cambió", () => {
    const data = buildDirtyTaskData(task(), form({ priority: "critical" }));
    expect(data).toEqual({ priority: "critical" });
  });

  it("recoge varios cambios a la vez", () => {
    const data = buildDirtyTaskData(
      task(),
      form({ title: "Nuevo", energyLevel: "high", description: "notas" }),
    );
    expect(data).toEqual({ title: "Nuevo", energyLevel: "high", description: "notas" });
  });

  it("una descripción borrada viaja como undefined, no como string vacío", () => {
    const data = buildDirtyTaskData(task({ description: "algo" }), form({ description: "" }));
    expect("description" in data).toBe(true);
    expect(data.description).toBeUndefined();
  });
});

describe("buildDirtyTaskData · fechas", () => {
  it("manda la fecha como ISO conservando la hora", () => {
    const d = new Date("2026-03-04T15:30:00.000Z");
    const data = buildDirtyTaskData(task(), form({ dueDate: d }));
    expect(data.dueDate).toBe(d.toISOString());
  });

  it("limpiar una fecha existente manda null, no la omite", () => {
    const data = buildDirtyTaskData(
      task({ dueDate: "2026-03-04T15:00:00.000Z" }),
      form({ dueDate: undefined }),
    );
    expect(data.dueDate).toBeNull();
  });

  it("startDate sigue exactamente la misma regla que dueDate", () => {
    const limpiada = buildDirtyTaskData(
      task({ startDate: "2026-03-04T09:00:00.000Z" }),
      form({ startDate: undefined }),
    );
    expect(limpiada.startDate).toBeNull();

    const d = new Date("2026-03-05T09:00:00.000Z");
    expect(buildDirtyTaskData(task(), form({ startDate: d })).startDate).toBe(d.toISOString());
  });
});

describe("buildDirtyTaskData · selects con opción 'none'", () => {
  it("'none' significa null, no el string", () => {
    const data = buildDirtyTaskData(
      task({ folderId: "f1", sprintId: "s1" }),
      form({ selectedFolderId: "none", sprintId: "none" }),
    );
    expect(data.folderId).toBeNull();
    expect(data.sprintId).toBeNull();
  });

  it("asignar una carpeta manda su id", () => {
    const data = buildDirtyTaskData(task(), form({ selectedFolderId: "f9" }));
    expect(data.folderId).toBe("f9");
  });
});

describe("buildDirtyTaskData · metadata", () => {
  it("compara por contenido, no por referencia", () => {
    const data = buildDirtyTaskData(
      task({ metadata: { eventSubtype: "exam" } }),
      form({ metadata: { eventSubtype: "exam" } }),
    );
    expect(data).toEqual({});
  });

  it("detecta un cambio real dentro del objeto", () => {
    const data = buildDirtyTaskData(
      task({ metadata: { eventSubtype: "exam" } }),
      form({ metadata: { eventSubtype: "exam", grade: 95 } }),
    );
    expect(data.metadata).toEqual({ eventSubtype: "exam", grade: 95 });
  });
});

describe("withDay y withTime", () => {
  it("cambiar de día conserva la hora que ya tenía", () => {
    const prev = new Date(2026, 2, 4, 15, 30);
    const next = withDay(prev, new Date(2026, 2, 10, 0, 0));
    expect(next?.getDate()).toBe(10);
    expect(next?.getHours()).toBe(15);
    expect(next?.getMinutes()).toBe(30);
  });

  it("elegir día sin fecha previa deja la medianoche del Calendar", () => {
    const next = withDay(undefined, new Date(2026, 2, 10, 0, 0));
    expect(next?.getHours()).toBe(0);
  });

  it("deseleccionar el día devuelve undefined", () => {
    expect(withDay(new Date(), undefined)).toBeUndefined();
  });

  it("withTime aplica la hora sobre la fecha actual", () => {
    const next = withTime(new Date(2026, 2, 4, 0, 0), "09:45");
    expect(next?.getHours()).toBe(9);
    expect(next?.getMinutes()).toBe(45);
  });

  it("withTime no hace nada sin fecha previa ni con valor vacío", () => {
    expect(withTime(undefined, "09:45")).toBeUndefined();
    const d = new Date(2026, 2, 4, 8, 0);
    expect(withTime(d, "")).toBe(d);
  });
});

describe("hasDueTime", () => {
  it("medianoche local cuenta como 'sin hora'", () => {
    expect(hasDueTime(new Date(2026, 2, 4, 0, 0))).toBe(false);
  });

  it("cualquier otra hora cuenta como hora significativa", () => {
    expect(hasDueTime(new Date(2026, 2, 4, 0, 1))).toBe(true);
    expect(hasDueTime(new Date(2026, 2, 4, 9, 0))).toBe(true);
  });
});

describe("needsGradeField", () => {
  it("pide calificación sólo si el evento académico ya se completó", () => {
    expect(needsGradeField(true, "event", { eventSubtype: "exam" })).toBe(true);
    expect(needsGradeField(false, "event", { eventSubtype: "exam" })).toBe(false);
  });

  it("no la pide para un evento que no es examen, quiz o práctica", () => {
    expect(needsGradeField(true, "event", { eventSubtype: "clase" })).toBe(false);
    expect(needsGradeField(true, "event", null)).toBe(false);
  });

  it("no la pide para tipos que no son evento", () => {
    expect(needsGradeField(true, "task", { eventSubtype: "exam" })).toBe(false);
  });
});

describe("formatDuration", () => {
  it("bajo una hora muestra minutos", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("horas exactas omiten los minutos", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("horas con resto muestran ambos", () => {
    expect(formatDuration(95)).toBe("1h 35min");
  });
});

describe("taskJsonFilename", () => {
  it("convierte el título en un nombre de archivo seguro", () => {
    expect(taskJsonFilename("Leer «El Quijote»: cap. 3")).toBe("leer-el-quijote-cap-3.json");
  });

  it("cae a un nombre por defecto sin título", () => {
    expect(taskJsonFilename(null)).toBe("tarea.json");
  });
});
