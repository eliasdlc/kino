import { describe, expect, it } from "vitest";
import type { CreateTaskInput } from "./tasks.types";
import {
  STEP_FIELDS,
  buildCreateTaskPayload,
  buildStudyPlanTasks,
  formSchema,
  formatDuration,
  nlChipVisibility,
  type FormValues,
} from "./create-task.helpers";

/**
 * Salió de CreateTaskDialog en KIN-146 (FE-05). `buildStudyPlanTasks` es el
 * que más lo necesitaba: cuenta días hacia atrás desde la fecha del examen y
 * eso vivía dentro del onSubmit del componente.
 */

function values(partial: Partial<FormValues> = {}): FormValues {
  return {
    title: "Tarea",
    priority: "medium",
    energyLevel: "medium",
    ...partial,
  } as FormValues;
}

const SYSTEM_ID = "5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d";

describe("buildCreateTaskPayload", () => {
  it("recorta el título y arrastra el sistema", () => {
    const p = buildCreateTaskPayload(values({ title: "  Leer  " }), {
      systemId: SYSTEM_ID,
      hideEnergyAndPriority: false,
    });
    expect(p.title).toBe("Leer");
    expect(p.systemId).toBe(SYSTEM_ID);
  });

  it("omite los campos vacíos en vez de mandarlos nulos", () => {
    const p = buildCreateTaskPayload(values(), { systemId: SYSTEM_ID, hideEnergyAndPriority: false });
    for (const k of ["dueDate", "startDate", "description", "folderId", "sprintId", "parentTaskId"]) {
      expect(k in p).toBe(false);
    }
  });

  it("omite la energía cuando el tipo de tarea la esconde", () => {
    const p = buildCreateTaskPayload(values({ energyLevel: "high" }), {
      systemId: SYSTEM_ID,
      hideEnergyAndPriority: true,
    });
    expect(p.energyLevel).toBeUndefined();
  });

  it("convierte la fecha de día a ISO local, sin desplazar el día", () => {
    const p = buildCreateTaskPayload(values({ dueDate: "2026-03-04" }), {
      systemId: SYSTEM_ID,
      hideEnergyAndPriority: false,
    });
    expect(p.dueDate).toContain("2026-03-04");
  });

  it("incluye el padre cuando la tarea es una subtarea", () => {
    const p = buildCreateTaskPayload(values(), {
      systemId: SYSTEM_ID,
      parentTaskId: "padre-1",
      hideEnergyAndPriority: false,
    });
    expect(p.parentTaskId).toBe("padre-1");
  });
});

describe("buildStudyPlanTasks", () => {
  function examen(partial: Partial<CreateTaskInput> = {}): CreateTaskInput {
    return {
      systemId: SYSTEM_ID,
      title: "Parcial de Cálculo",
      startDate: new Date(2026, 4, 20, 9, 0).toISOString(),
      metadata: { eventSubtype: "exam", generateStudyPlan: true },
      ...partial,
    } as CreateTaskInput;
  }

  it("genera dos repasos, a 5 y a 2 días antes del examen", () => {
    const plan = buildStudyPlanTasks(examen(), "padre-1", SYSTEM_ID);

    expect(plan).toHaveLength(2);
    expect(new Date(plan[0].startDate!).getDate()).toBe(15);
    expect(new Date(plan[1].startDate!).getDate()).toBe(18);
  });

  it("cuenta hacia atrás cruzando el cambio de mes", () => {
    const plan = buildStudyPlanTasks(
      examen({ startDate: new Date(2026, 4, 3, 9, 0).toISOString() }),
      "padre-1",
      SYSTEM_ID,
    );

    // 3 de mayo menos 5 días = 28 de abril.
    expect(new Date(plan[0].startDate!).getMonth()).toBe(3);
    expect(new Date(plan[0].startDate!).getDate()).toBe(28);
  });

  it("nombra los repasos a partir del título del examen", () => {
    const plan = buildStudyPlanTasks(examen(), "padre-1", SYSTEM_ID);

    expect(plan[0].title).toBe("Repaso 1: Parcial de Cálculo");
    expect(plan[1].title).toBe("Repaso Final: Parcial de Cálculo");
  });

  it("cuelga los repasos del examen y los deja en backlog con energía alta", () => {
    const plan = buildStudyPlanTasks(examen(), "padre-9", SYSTEM_ID);

    for (const t of plan) {
      expect(t.parentTaskId).toBe("padre-9");
      expect(t.status).toBe("backlog");
      expect(t.energyLevel).toBe("high");
      expect(t.priority).toBe("high");
    }
  });

  it("también aplica a un quiz", () => {
    const plan = buildStudyPlanTasks(
      examen({ metadata: { eventSubtype: "quiz", generateStudyPlan: true } }),
      "p",
      SYSTEM_ID,
    );
    expect(plan).toHaveLength(2);
  });

  it("no genera nada si el usuario no activó el plan de estudio", () => {
    const plan = buildStudyPlanTasks(
      examen({ metadata: { eventSubtype: "exam" } }),
      "p",
      SYSTEM_ID,
    );
    expect(plan).toEqual([]);
  });

  it("no genera nada para un evento que no es evaluable", () => {
    const plan = buildStudyPlanTasks(
      examen({ metadata: { eventSubtype: "clase", generateStudyPlan: true } }),
      "p",
      SYSTEM_ID,
    );
    expect(plan).toEqual([]);
  });

  it("no genera nada sin fecha desde la que contar hacia atrás", () => {
    const plan = buildStudyPlanTasks(examen({ startDate: undefined }), "p", SYSTEM_ID);
    expect(plan).toEqual([]);
  });

  it("no genera nada cuando no hay metadata", () => {
    const plan = buildStudyPlanTasks(examen({ metadata: null }), "p", SYSTEM_ID);
    expect(plan).toEqual([]);
  });
});

describe("nlChipVisibility", () => {
  const parsed = {
    title: "x",
    dueDate: "2026-03-04",
    priority: "high" as const,
    systemHint: "kino",
    tagHint: "bug",
    estimatedMinutes: 45,
  };

  it("muestra todos los chips de lo que el parser detectó", () => {
    const v = nlChipVisibility(parsed, new Set());
    expect(v).toMatchObject({ date: true, priority: true, system: true, tag: true, duration: true, any: true });
  });

  it("oculta el chip que el usuario descartó", () => {
    const v = nlChipVisibility(parsed, new Set(["priority"]));
    expect(v.priority).toBe(false);
    expect(v.date).toBe(true);
  });

  it("any es false cuando no quedó ningún chip", () => {
    const v = nlChipVisibility(parsed, new Set(["dueDate", "priority", "systemHint", "tagHint", "estimatedMinutes"]));
    expect(v.any).toBe(false);
  });

  it("sin parseo no hay chips", () => {
    expect(nlChipVisibility(null, new Set()).any).toBe(false);
  });
});

describe("formatDuration", () => {
  it("muestra sólo minutos por debajo de la hora", () => {
    expect(formatDuration(45)).toBe("45min");
  });

  it("omite los minutos en horas exactas", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("muestra ambos cuando hay resto", () => {
    expect(formatDuration(95)).toBe("1h 35min");
  });
});

describe("formSchema y pasos", () => {
  it("el título es obligatorio", () => {
    const r = formSchema.safeParse({ title: "", priority: "medium", energyLevel: "medium" });
    expect(r.success).toBe(false);
  });

  it("acepta lo mínimo viable", () => {
    const r = formSchema.safeParse({ title: "Leer", priority: "medium", energyLevel: "medium" });
    expect(r.success).toBe(true);
  });

  it("el paso 1 valida el título y el 2 prioridad y energía", () => {
    expect(STEP_FIELDS[1]).toEqual(["title"]);
    expect(STEP_FIELDS[2]).toEqual(["priority", "energyLevel"]);
    expect(STEP_FIELDS[3]).toEqual([]);
  });
});
