/**
 * Criterio: Planificación en el teléfono mueve de día con una operación con
 * nombre. "Más acciones" abre una hoja con "Mover a otro día", que lista los
 * siete días de la semana (el actual deshabilitado) y avisa del elegido. La
 * tachada se queda en su día con el círculo lleno, y la tira de días es un
 * grupo de radios pegados que las flechas recorren.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { addDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { renderMobile } from "@/shared/testing/render";
import type { TaskTransport } from "./tasks.types";
import { TaskPlanningMobileView } from "./TaskPlanningMobileView";
import { conDedo } from "./puntero.testing";

const lunes = startOfWeek(new Date(), { weekStartsOn: 1 });
const semana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
const hoy = (new Date().getDay() + 6) % 7;

/** A mediodía local, para que caiga en su día sin importar la zona. */
const alMediodia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();

const tareaHoy = (over: Partial<TaskTransport> = {}) =>
  ({
    id: "t1",
    title: "Estudiar para el parcial",
    status: "week",
    priority: "medium",
    effectivePriority: "medium",
    energyLevel: "medium",
    startDate: alMediodia(semana[hoy]!),
    dueDate: null,
    estimatedTime: null,
    taskType: "task",
    systemId: "s1",
    folderId: null,
    metadata: null,
    ...over,
  }) as unknown as TaskTransport;

function pintar(over: Partial<React.ComponentProps<typeof TaskPlanningMobileView>> = {}) {
  const onMoveToDay = vi.fn<(taskId: string, dayISO: string) => void>();
  const vista = renderMobile(
    <TaskPlanningMobileView
      weekDates={semana}
      weekOffset={0}
      monthHeading="octubre 2026"
      weekNumber={42}
      singleDayTasks={[tareaHoy()]}
      multiDayTasks={[]}
      onPrevWeek={vi.fn()}
      onNextWeek={vi.fn()}
      onResetWeek={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
      onMoveToDay={onMoveToDay}
      {...over}
    />,
  );
  return { ...vista, onMoveToDay };
}

/** Abre la hoja de los siete días desde la fila, como lo hace el dedo. */
function abrirMoverDeDia() {
  fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Mover a otro día" }));
  return screen.findByRole("dialog", { name: "Mover a otro día" });
}

describe("TaskPlanningMobileView", () => {
  it("Más acciones abre una hoja con Mover a otro día", () => {
    conDedo();
    pintar();

    fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));

    expect(screen.getByRole("dialog", { name: "Estudiar para el parcial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover a otro día" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover a la papelera" })).toBeInTheDocument();
  });

  it("Mover a otro día lista los siete días de la semana", async () => {
    conDedo();
    pintar();

    const hoja = await abrirMoverDeDia();

    const dias = within(hoja).getAllByRole("button").filter((b) => b.textContent !== "Cerrar");
    expect(dias).toHaveLength(7);
    semana.forEach((fecha, i) => {
      expect(dias[i]).toHaveTextContent(format(fecha, "EEEE", { locale: es }));
    });
  });

  it("elegir otro día llama a onMoveToDay con la tarea y el día en yyyy-MM-dd", async () => {
    conDedo();
    const { onMoveToDay } = pintar();
    const otro = (hoy + 1) % 7;

    const hoja = await abrirMoverDeDia();
    fireEvent.click(within(hoja).getByRole("button", { name: new RegExp(format(semana[otro]!, "EEEE", { locale: es })) }));

    expect(onMoveToDay).toHaveBeenCalledExactlyOnceWith("t1", format(semana[otro]!, "yyyy-MM-dd"));
  });

  it("el día actual está deshabilitado y tocarlo no mueve nada", async () => {
    conDedo();
    const { onMoveToDay } = pintar();

    const hoja = await abrirMoverDeDia();
    const actual = within(hoja).getByRole("button", { name: new RegExp(format(semana[hoy]!, "EEEE", { locale: es })) });

    expect(actual).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(actual);
    expect(onMoveToDay).not.toHaveBeenCalled();
  });

  it("la tarea tachada en esta visita se queda en su día con el círculo lleno", () => {
    pintar({ singleDayTasks: [tareaHoy({ status: "done" })], struck: new Set(["t1"]) });

    expect(screen.getByRole("button", { name: "Completar Estudiar para el parcial" })).toHaveAttribute("aria-pressed", "true");
  });

  it("la tira de días es un grupo de radios sin hueco entre días", () => {
    pintar();

    const grupo = screen.getByRole("radiogroup", { name: "Día" });

    expect(grupo).not.toHaveClass("gap-1");
    expect(grupo.className).not.toMatch(/(^|\s)gap-/);
    expect(within(grupo).getAllByRole("radio")).toHaveLength(7);
    expect(within(grupo).getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("la flecha derecha elige el día de al lado", () => {
    pintar();
    const radios = within(screen.getByRole("radiogroup", { name: "Día" })).getAllByRole("radio");
    expect(radios[hoy]).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radios[hoy]!, { key: "ArrowRight" });

    const siguiente = (hoy + 1) % 7;
    expect(radios[siguiente]).toHaveAttribute("aria-checked", "true");
    expect(radios[hoy]).toHaveAttribute("aria-checked", "false");
  });
});
