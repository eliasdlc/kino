/**
 * Criterio: la etiqueta del campo de ciclo la puede leer una persona. Decía
 * `SprintTransport`, el nombre de un tipo de TypeScript que cruzó del código al
 * copy en un renombrado mecánico, y ningún test miraba esta pantalla.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { makeSprint } from "@/app/system-design/mock-data";
import { renderWithProviders } from "@/shared/testing/render";
import { getTaskDialogFields } from "./task-dialog-config";
import { getTaskTypeConfig } from "./task-type-config";
import { TaskPlanningFields } from "./TaskPlanningFields";
import type { FormValues } from "./CreateTaskDialog";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const CICLO = makeSprint({ name: "Ciclo 3" });

/** El paso 2 del diálogo necesita un formulario vivo; este es el mínimo. */
function Harness() {
  const form = useForm<FormValues>({
    defaultValues: { title: "", priority: "medium", energyLevel: "medium", taskType: "task", sprintId: null },
  });
  return (
    <TaskPlanningFields
      form={form}
      systemId={String(CICLO.systemId)}
      systemTemplateType="project"
      fields={getTaskDialogFields("project")}
      typeConfig={getTaskTypeConfig("task")}
      taskType="task"
      folders={[]}
      sprints={[CICLO]}
      dateRange={{ from: undefined, to: undefined }}
      setDateRange={() => {}}
    />
  );
}

describe("TaskPlanningFields", () => {
  it("el campo del ciclo se llama Ciclo, no como su tipo", () => {
    renderWithProviders(<Harness />);

    expect(screen.getByText("Ciclo")).toBeVisible();
    expect(screen.queryByText(/SprintTransport/)).toBeNull();
  });

  it("el hueco de «sin ciclo» también se lee en palabras", () => {
    renderWithProviders(<Harness />);

    expect(screen.getByText("Sin ciclo")).toBeVisible();
  });
});
