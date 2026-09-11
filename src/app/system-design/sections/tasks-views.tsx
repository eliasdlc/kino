"use client";

import { AcademicWorkspace } from "@/features/academic/AcademicWorkspace";
import { DefaultTaskCard } from "@/features/tasks/cards/DefaultTaskCard";
import { Suspense, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { Section, SubSection, Specimen, SpecimenGrid, ClientOnly, Seeded, seedQuery } from "../helpers";
import { api } from "@convex/_generated/api";
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
import { InboxView } from "@/features/systems/views/InboxView";
import { PersonalView } from "@/features/systems/views/PersonalView";
import { makeFolder, makeSystem } from "../mock-data";
import type { TaskTypeValue } from "@/shared/types/enums";

const noop = () => {};

const BANDEJA = makeSystem({ id: mid("sys-0"), name: "Bandeja", templateType: "inbox", isInbox: true });
const PERSONAL = makeSystem({ id: mid("sys-p"), name: "Casa y salud", templateType: "personal", icon: "star" });

/** Lo que entró sin decidir dónde va, con su fuente cuando la tiene. */
const CAPTURAS = [
  makeTask({ id: mid("in-1"), systemId: BANDEJA.id, title: "Llamar al banco por el certificado", status: "backlog" }),
  makeTask({ id: mid("in-2"), systemId: BANDEJA.id, title: "Revisar el contrato de la beca de la universidad", status: "backlog", externalSource: "link" }),
  makeTask({ id: mid("in-3"), systemId: BANDEJA.id, title: "Idea: modo lectura para los apuntes", status: "backlog" }),
  makeTask({ id: mid("in-4"), systemId: BANDEJA.id, title: "Pagar el dominio", status: "backlog" }),
  makeTask({ id: mid("in-5"), systemId: BANDEJA.id, title: "Arreglar el bug del calendario", status: "backlog", externalSource: "github" }),
  makeTask({ id: mid("in-6"), systemId: BANDEJA.id, title: "Comprar los pasajes", status: "backlog" }),
  makeTask({ id: mid("in-7"), systemId: BANDEJA.id, title: "Nota de voz del lunes", status: "backlog", externalSource: "voice" }),
  makeTask({ id: mid("in-8"), systemId: BANDEJA.id, title: "Renovar la licencia", status: "backlog" }),
];

const AREAS = [
  makeFolder({ id: mid("area-1"), name: "Salud", systemId: PERSONAL.id }),
  makeFolder({ id: mid("area-2"), name: "Casa", systemId: PERSONAL.id }),
  makeFolder({ id: mid("area-3"), name: "Papeles y trámites", systemId: PERSONAL.id }),
];

const VIDA = [
  makeTask({ id: mid("p-1"), systemId: PERSONAL.id, title: "Caminar 30 minutos", status: "today", metadata: { kind: "habit" } }),
  makeTask({ id: mid("p-2"), systemId: PERSONAL.id, title: "Cita con el dentista, 4:00", status: "today", metadata: { kind: "event" } }),
  makeTask({ id: mid("p-3"), systemId: PERSONAL.id, title: "Cambiar el filtro del agua", status: "backlog", folderId: AREAS[1]!.id, metadata: { kind: "errand" } }),
  makeTask({ id: mid("p-4"), systemId: PERSONAL.id, title: "Renovar la licencia", status: "backlog", folderId: AREAS[2]!.id, metadata: { kind: "errand" } }),
  makeTask({ id: mid("p-5"), systemId: PERSONAL.id, title: "Pedir la analítica", status: "backlog", folderId: AREAS[0]!.id, metadata: { kind: "errand" } }),
];

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
    makeSprint({ id: mid("spr-2"), name: "Ciclo 2", status: "completed" }),
  ];

  return (
    <Section
      id="tareas"
      number="12"
      title="Tareas — vistas y controles"
      description="Las demás representaciones de una tarea (fila de lista global, card de planning, card del board kanban) y los pickers que las editan."
    >
      <SubSection title="Títulos completos y ciclos académicos" description="Cards con altura natural y árbol de años, ciclos y materias.">
        <Specimen label="Título largo en Acción y Planificación">
          <div className="grid max-w-3xl items-start gap-4 md:grid-cols-2">
            <DefaultTaskCard task={makeTask({ title: "Bajar de la PVA: informaciones generales y el desglose del primer mes", priority: "high" })} systemId={MOCK_SYSTEM_ID} onToggle={noop} onDelete={noop} onEdit={noop} />
            <div className="max-w-48"><PlanningTaskCard task={makeTask({ title: "Bajar de la PVA: informaciones generales y el desglose del primer mes" })} onToggle={noop} onDelete={noop} onEdit={noop} /></div>
          </div>
        </Specimen>
        <Seeded stubs={[
          seedQuery(api.academicPeriods.list, [
            { _id: "cycle-current", year: "2026–2027", name: "Septiembre–diciembre", isCurrent: true, isClosed: false },
            { _id: "cycle-old", year: "2025–2026", name: "Septiembre–diciembre", isCurrent: false, isClosed: true },
          ]),
          seedQuery(api.folders.bySystem, [{ ...makeFolder({ name: "Inteligencia de Negocios" }), academicPeriodId: "cycle-current" }]),
        ]}>
          <Specimen label="Árbol académico"><Suspense fallback={<div className="h-52" />}><AcademicWorkspace systemId={MOCK_SYSTEM_ID}><p className="text-sm">Las vistas de tareas y apuntes comparten el ciclo seleccionado.</p></AcademicWorkspace></Suspense></Specimen>
        </Seeded>
      </SubSection>
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
        description="La card arrastrable del board con badge de estancamiento («Xd sin avanzar») y la barra de ciclos con filtro. Columnas: Por hacer · En progreso · En review · Hecho."
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

      <SubSection
        title="Bandeja y Personal"
        description="Las dos vistas que faltaban de las seis. Bandeja es un embudo de triaje sin carpetas a propósito, así que no monta el funnel de cuatro tabs; su empuje de ocho items es una fila de estado sin pregunta, sin botón de descartar, porque se va cuando la Bandeja baja de ocho. Personal pone Hoy delante de las áreas, que es lo único con hora de caducidad."
      >
        <SpecimenGrid cols={2}>
          <Specimen label="Bandeja vacía" hint="0 items" className="items-stretch">
            <Seeded stubs={[seedQuery(api.tasks.bySystem, [])]}>
              <div className="w-full">
                <InboxView system={BANDEJA} initialTasks={[]} />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Bandeja con una cosa" hint="1 item, no una lista con algo flotando" className="items-stretch">
            <Seeded stubs={[seedQuery(api.tasks.bySystem, CAPTURAS.slice(0, 1))]}>
              <div className="w-full">
                <InboxView system={BANDEJA} initialTasks={CAPTURAS.slice(0, 1)} />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Bandeja con el empuje" hint="8 items, fila de estado sin pregunta" className="items-stretch">
            <Seeded stubs={[seedQuery(api.tasks.bySystem, CAPTURAS)]}>
              <div className="w-full">
                <InboxView system={BANDEJA} initialTasks={CAPTURAS} />
              </div>
            </Seeded>
          </Specimen>
          <Specimen label="Personal" hint="Hoy arriba, luego las áreas" className="items-stretch">
            <Seeded
              stubs={[
                seedQuery(api.tasks.bySystem, VIDA),
                seedQuery(api.folders.bySystem, AREAS),
              ]}
            >
              <div className="w-full">
                <PersonalView system={PERSONAL} initialTasks={VIDA} />
              </div>
            </Seeded>
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
