/**
 * Criterio: el filtro Tipo = Tarea encuentra todo lo que el producto trata
 * como tarea (taskType "task", sin tipo o el "todo" de antes) y deja fuera las
 * ideas, los eventos y lo demás.
 */
import { describe, expect, it } from "vitest";
import { applyFilters, DEFAULT_FILTERS } from "./taskFilters";
import type { TaskTransport } from "@/features/tasks/tasks.types";

const tarea = (id: string, taskType: string | null) => ({ id, taskType, systemId: "s1" }) as unknown as TaskTransport;

describe("applyFilters por tipo", () => {
  it("Tarea conserva task, sin tipo y todo, y descarta la idea", () => {
    const tareas = [tarea("a", "task"), tarea("b", null), tarea("c", "todo"), tarea("d", "idea")];

    const vistas = applyFilters(tareas, { ...DEFAULT_FILTERS, type: ["task"] });

    expect(vistas.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("Idea sólo encuentra las ideas", () => {
    const tareas = [tarea("a", "task"), tarea("b", null), tarea("d", "idea")];

    const vistas = applyFilters(tareas, { ...DEFAULT_FILTERS, type: ["idea"] });

    expect(vistas.map((t) => t.id)).toEqual(["d"]);
  });
});
