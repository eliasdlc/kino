"use client";

import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { Section, SubSection, Specimen, SpecimenGrid, ClientOnly } from "../helpers";
import { makeTask, makeSprint, daysFromNow, MOCK_SYSTEM_ID, mid } from "../mock-data";
import { TaskListRow } from "@/features/tasks/TaskListRow";
import { OverdueGroup } from "@/features/tasks/OverdueGroup";
import { PlanningTaskCard } from "@/features/tasks/PlanningTaskCard";
import { BulkActionBar } from "@/features/tasks/BulkActionBar";
import { TaskTypePicker } from "@/features/tasks/TaskTypePicker";
import { EstimatedTimePicker } from "@/features/tasks/EstimatedTimePicker";
import { RecurrencePicker } from "@/features/tasks/RecurrencePicker";
import { MultiDayTaskBar } from "@/features/tasks/MultiDayTaskBar";
import { BoardCard } from "@/features/systems/views/project/BoardCard";
import { SprintBar } from "@/features/systems/views/project/SprintBar";
import type { TaskTypeValue } from "@/shared/types/enums";

const noop = () => {};

const SYSTEM_MAP = new Map([
  [MOCK_SYSTEM_ID, { id: MOCK_SYSTEM_ID, name: "Universidad", color: "blue" }],
]);

export function TasksViewsSection() {
  const [taskType, setTaskType] = useState<TaskTypeValue | undefined>("task");
  const [estimated, setEstimated] = useState<number | null>(60);
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);

  const sprints = [
    makeSprint(),
    makeSprint({ id: mid("spr-2"), name: "Sprint 2", status: "completed" }),
  ];

  return (
    <Section
      id="tareas"
      number="12"
      title="Tareas — vistas y controles"
      description="Las demás representaciones de una tarea (fila de lista global, card de planning, card del board kanban) y los pickers que las editan."
    >
      <SubSection
        title="TaskListRow"
        description="Fila de la vista global /tasks: badge de prioridad, sistema con punto de color, selección múltiple."
      >
        <div className="max-w-2xl space-y-1">
          <TaskListRow
            task={makeTask({ title: "Fila normal con sistema", priority: "high", dueDate: daysFromNow(3) })}
            systemMap={SYSTEM_MAP}
            onToggle={noop}
            onOpen={noop}
          />
          <TaskListRow
            task={makeTask({ id: mid("r2"), title: "Fila enfocada (navegación con teclado)" })}
            systemMap={SYSTEM_MAP}
            onToggle={noop}
            onOpen={noop}
            isFocused
          />
          <TaskListRow
            task={makeTask({ id: mid("r3"), title: "Fila seleccionada (bulk)" })}
            systemMap={SYSTEM_MAP}
            onToggle={noop}
            onOpen={noop}
            isSelected
            onSelectionToggle={noop}
          />
          <TaskListRow
            task={makeTask({ id: mid("r4"), title: "Completada", status: "done" })}
            systemMap={SYSTEM_MAP}
            onToggle={noop}
            onOpen={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="OverdueGroup"
        description="Grupo colapsable de vencidas con acción bulk «mover a hoy»."
      >
        <div className="max-w-2xl">
          <OverdueGroup
            tasks={[
              makeTask({ id: mid("o1"), title: "Entregar práctica 4", dueDate: daysFromNow(-2) }),
              makeTask({ id: mid("o2"), title: "Pagar matrícula", dueDate: daysFromNow(-5), priority: "critical" }),
            ]}
            systemMap={SYSTEM_MAP}
            onOpen={noop}
            onToggle={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="PlanningTaskCard"
        description="La card compacta de la vista de planning semanal."
      >
        <div className="grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
          <PlanningTaskCard
            task={makeTask({ title: "Preparar presentación", priority: "high", dueDate: daysFromNow(2) })}
            onToggle={noop}
            onDelete={noop}
            onEdit={noop}
          />
          <PlanningTaskCard
            task={makeTask({ id: mid("pl2"), title: "Completada", status: "done" })}
            onToggle={noop}
            onDelete={noop}
            onEdit={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="Board kanban (project) — BoardCard y SprintBar"
        description="La card arrastrable del board con badge de estancamiento («Xd sin avanzar») y la barra de sprints con filtro. Columnas: Por hacer · En progreso · En review · Hecho."
      >
        <div className="max-w-2xl space-y-4">
          <SprintBar
            systemId={MOCK_SYSTEM_ID}
            sprints={sprints}
            tasks={[makeTask({ sprintId: mid("spr-1") })]}
            sprintFilter={sprintFilter}
            onSelectFilter={setSprintFilter}
          />
          {/* dnd-kit genera ids no deterministas para la accesibilidad del drag, así
              que el HTML del servidor y el del cliente nunca coinciden. Montar solo
              en cliente evita ensuciar la consola del catálogo con un mismatch que
              no existe en la app, donde el board siempre llega tras la query. */}
          <ClientOnly>
            <DndContext>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BoardCard
                  task={makeTask({
                    id: mid("b1"),
                    title: "Card en progreso, estancada",
                    boardStatus: "in_progress",
                    boardStatusChangedAt: daysFromNow(-10),
                  })}
                  systemId={MOCK_SYSTEM_ID}
                  onToggle={noop}
                  onDelete={noop}
                  onEdit={noop}
                  onMoveColumn={noop}
                />
                <BoardCard
                  task={makeTask({
                    id: mid("b2"),
                    title: "Card recién movida a review",
                    boardStatus: "review",
                    boardStatusChangedAt: new Date().toISOString(),
                    priority: "high",
                  })}
                  systemId={MOCK_SYSTEM_ID}
                  onToggle={noop}
                  onDelete={noop}
                  onEdit={noop}
                  onMoveColumn={noop}
                />
              </div>
            </DndContext>
          </ClientOnly>
        </div>
      </SubSection>

      <SubSection
        title="BulkActionBar"
        description="Barra de acciones al seleccionar varias tareas: fecha, prioridad, vaciar selección."
      >
        <div className="max-w-2xl overflow-hidden rounded-lg border border-border">
          <BulkActionBar
            selectedIds={new Set(["a", "b", "c"])}
            onClear={noop}
            onVaciar={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="Pickers de edición"
        description="Los tres pickers propios del formulario de tarea (interactivos). TimePicker y Calendar están en Formularios."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="TaskTypePicker" hint="tipo + subtipos académicos" className="items-stretch">
            <div className="w-full">
              <TaskTypePicker
                value={taskType}
                systemTemplateType="academic"
                onChange={(v) => setTaskType(v)}
              />
            </div>
          </Specimen>
          <Specimen label="EstimatedTimePicker" hint="presets + custom en minutos" className="items-stretch">
            <div className="w-full">
              <EstimatedTimePicker value={estimated} onChange={setEstimated} />
            </div>
          </Specimen>
          <Specimen label="RecurrencePicker" hint="regla de repetición" className="items-stretch">
            <div className="w-full">
              <RecurrencePicker value={recurrence} onChange={setRecurrence} />
            </div>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="MultiDayTaskBar"
        description="Barra multi-día del calendario, coloreada por prioridad, posicionada por columnas de grid."
      >
        <div className="grid max-w-2xl grid-cols-7 gap-y-1 rounded-lg border border-dashed border-border p-3">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
            <div key={d} className="pb-1 text-center text-[10px] text-muted-foreground">
              {d}
            </div>
          ))}
          <MultiDayTaskBar
            task={makeTask({ title: "Semana de exámenes", priority: "critical" })}
            startCol={1}
            span={5}
          />
          <MultiDayTaskBar
            task={makeTask({ id: mid("m2"), title: "Viaje", priority: "low" })}
            startCol={4}
            span={3}
          />
        </div>
      </SubSection>
    </Section>
  );
}
