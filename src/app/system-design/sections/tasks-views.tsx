"use client";

import { CyclePicker } from "@/features/academic/CyclePicker";
import { ClassCard } from "@/features/academic/ClassCard";
import { DefaultTaskCard } from "@/features/tasks/cards/DefaultTaskCard";
import { Suspense, useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { Section, SubSection, Specimen, SpecimenGrid, ClientOnly, Seeded, seedQuery } from "../helpers";
import { api } from "@convex/_generated/api";
import { makeTask, makeSprint, daysFromNow, MOCK_SYSTEM_ID, mid, CAPTURA_CON_ITEMS, CAPTURA_POR_CADUCAR } from "../mock-data";
import { TaskRow } from "@/features/tasks/TaskRow";
import { KinoSuggestedSection } from "@/features/tasks/KinoSuggestedSection";
import { TasksPageSkeleton } from "@/features/tasks/TasksSkeleton";
import { CascadeInboxMode } from "@/features/tasks/CascadeInboxMode";
import { TaskFilterPanel } from "@/features/tasks/TaskFilterPanel";
import { TaskDetailSheet } from "@/features/tasks/TaskDetailSheet";
import { DetailRow, VALOR_TOCABLE } from "@/features/tasks/TaskDetailFields";
import { Fichas } from "@/features/tasks/Fichas";
import { AllTasksList } from "@/features/tasks/AllTasksList";
import { KanbanSecciones } from "@/features/tasks/TaskKanbanView";
import { ENERGY_COLUMNS, kanbanColumnOf } from "@/features/tasks/kanban";
import { TaskPlanningMobileView } from "@/features/tasks/TaskPlanningMobileView";
import { TaskCalendarMobileView } from "@/features/tasks/TaskCalendarMobileView";
import { TaskTrashSection } from "@/features/tasks/TaskTrashSection";
import { es } from "date-fns/locale";
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { DEFAULT_FILTERS, type TaskFilters } from "@/lib/taskFilters";
import { CalendarArrowUp, ListChecks, Play, Trash2, X } from "lucide-react";
import { CaptureRow } from "@/features/captures/CaptureRow";
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

/** Los ciclos del catálogo, con los nombres reales del portal. */
const ACADEMIC_PERIODS = [
  { _id: "cycle-current", year: "2026-2027", name: "Septiembre de 2026", isCurrent: true, isClosed: false },
  { _id: "cycle-old", year: "2025-2026", name: "Enero de 2026", isCurrent: false, isClosed: true },
] as unknown as Parameters<typeof CyclePicker>[0]["initialPeriods"] & object[];

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

/** Lo sugerido del catálogo: lo que devuelve `insights.suggest`, con su porqué. */
const SUGERIDAS = [
  { ...makeTask({ id: mid("s1"), title: "Parcial de Cálculo III", priority: "critical", effectivePriority: "critical", dueDate: daysFromNow(-2), estimatedTime: "02:00" }), importanceScore: 90, why: "vencida", energyBand: "high" },
  { ...makeTask({ id: mid("s2"), title: "Bajar de la PVA: informaciones generales y el desglose del primer mes", priority: "high", effectivePriority: "high", dueDate: daysFromNow(1) }), importanceScore: 70, why: "vence mañana", energyBand: "high" },
  { ...makeTask({ id: mid("s3"), title: "Caminar 30 minutos", energyLevel: "low", inTodayPlan: true }), importanceScore: 40, why: "planeada para hoy", energyBand: "high" },
];

function TasksPageSpecimens() {
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  return (
    <SpecimenGrid cols={2}>
      <Specimen label="Segmento Lista | Calendario" hint="selección en tinta. En la página, Calendario monta el calendario global, cargado aparte; aquí va sólo el segmento">
        <Segmented
          aria-label="Vista de tareas"
          value={vista}
          onValueChange={setVista}
          options={[
            { value: "lista", label: "Lista" },
            { value: "calendario", label: "Calendario" },
          ]}
        />
      </Specimen>
      <Specimen label="Lo sugerido" hint="filas plan con el presupuesto; Al plan en palabra en la cola, ya en el plan dice en el plan en mute; la vencida no se sugiere (tiene su sección)" className="items-stretch">
        <Seeded stubs={[seedQuery(api.insights.suggest, SUGERIDAS), seedQuery(api.settings.get, { dailyEnergyLimit: 50 }), seedQuery(api.tasks.todayPlan, [])]}>
          <div className="w-full">
            <KinoSuggestedSection />
          </div>
        </Seeded>
      </Specimen>
      <Specimen label="Esqueleto de /tasks" hint="pinta igual lo fijo (título, voz entera, segmento, títulos de sección) y reserva el presupuesto a 4,5rem, un hueco de Vencidas y las filas a 3,9rem" className="items-stretch">
        <div className="w-full overflow-hidden rounded-xl border border-border">
          <TasksPageSkeleton />
        </div>
      </Specimen>
    </SpecimenGrid>
  );
}

function TasksSheetsSpecimens() {
  const [abierta, setAbierta] = useState<"detalle" | "repaso" | "filtros" | null>(null);
  const [filtros, setFiltros] = useState<TaskFilters>(DEFAULT_FILTERS);
  const tarea = makeTask({ id: mid("h1"), title: "Reescribir la apertura del capítulo 1", priority: "high", effectivePriority: "high", dueDate: daysFromNow(0), estimatedTime: "00:50" });
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setAbierta("detalle")}>Detalle de tarea</Button>
      <Button variant="secondary" onClick={() => setAbierta("repaso")}>Repasar una a una</Button>
      <Button variant="secondary" onClick={() => setAbierta("filtros")}>Filtros</Button>
      <TaskDetailSheet task={tarea} systemId={MOCK_SYSTEM_ID} open={abierta === "detalle"} onOpenChange={(o) => !o && setAbierta(null)} onComplete={() => setAbierta(null)} />
      <CascadeInboxMode tasks={[tarea, makeTask({ id: mid("h2"), title: "Pagar el dominio" })]} open={abierta === "repaso"} onOpenChange={(o) => !o && setAbierta(null)} />
      {/* El contenido de la hoja de filtros; la hoja de verdad, con su pie
          (Limpiar y Ver N tareas), se abre desde "Todas las tareas" abajo. */}
      {abierta === "filtros" && (
        <div className="w-full max-w-lg border-t border-input pt-4">
          <TaskFilterPanel filters={filtros} systems={[{ id: MOCK_SYSTEM_ID, name: "Universidad" }]} onChange={setFiltros} />
        </div>
      )}
    </div>
  );
}

/** Los renglones del detalle, sueltos: el rótulo en el margen, el valor en la columna de texto. */
function DetalleRenglonesSpecimen() {
  const [prioridad, setPrioridad] = useState<string>("high");
  const [energia, setEnergia] = useState<string>("medium");
  return (
    <div className="w-full max-w-lg">
      <DetailRow label="Prioridad" id="spec-prioridad">
        <div className="py-1.5">
          <Fichas
            label="Prioridad"
            labelledBy="spec-prioridad"
            options={[{ value: "critical", label: "Crítica" }, { value: "high", label: "Alta" }, { value: "medium", label: "Media" }, { value: "low", label: "Baja" }]}
            selected={[prioridad]}
            onToggle={setPrioridad}
          />
        </div>
      </DetailRow>
      <DetailRow label="Energía" id="spec-energia">
        <div className="py-1.5">
          <Fichas
            label="Energía"
            labelledBy="spec-energia"
            options={[{ value: "high", label: "Alta" }, { value: "medium", label: "Media" }, { value: "low", label: "Baja" }]}
            selected={[energia]}
            onToggle={setEnergia}
          />
        </div>
      </DetailRow>
      <DetailRow label="Vence" id="spec-vence">
        <button type="button" aria-labelledby="spec-vence" className={VALOR_TOCABLE}>
          18 oct 2026, 14:00
        </button>
      </DetailRow>
      <DetailRow label="Subtareas">
        <p className="pt-[0.6rem] text-base text-muted-foreground">Cada una con su círculo y su papelera de 48 px</p>
      </DetailRow>
    </div>
  );
}

const LISTA = [
  makeTask({ id: mid("l1"), title: "Entregar práctica 4", dueDate: daysFromNow(-2) }),
  makeTask({ id: mid("l2"), title: "Preparar la exposición del viernes", priority: "high", effectivePriority: "high", dueDate: daysFromNow(3), estimatedTime: "01:30" }),
  makeTask({ id: mid("l3"), title: "Leer el capítulo dos", energyLevel: "low", status: "backlog" }),
];

/** Acción con el dedo: secciones por energía, una fila tachada en su sitio. */
function KanbanSeccionesSpecimen() {
  const tareas = [
    makeTask({ id: mid("k1"), title: "Escribir la introducción", status: "today", energyLevel: "high" }),
    makeTask({ id: mid("k2"), title: "Ordenar la bibliografía", status: "done", energyLevel: "high" }),
    makeTask({ id: mid("k3"), title: "Responder al tutor", status: "week", energyLevel: "low" }),
  ];
  return (
    <div className="w-full max-w-lg">
      <KanbanSecciones
        columns={ENERGY_COLUMNS}
        tasksOf={(id) => tareas.filter((t) => kanbanColumnOf(t, "energy") === id)}
        groupBy="energy"
        struck={new Set([tareas[1]!.id])}
        onComplete={noop}
        onEdit={noop}
        onTrash={noop}
        onMove={noop}
      />
    </div>
  );
}

/** Planificación con el dedo: un día a la vez, mover de día con una hoja. */
function PlanificacionSpecimen() {
  const lunes = startOfWeek(new Date(), { weekStartsOn: 1 });
  const semana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  const hoy = new Date();
  const tareas = [
    makeTask({ id: mid("pl1"), title: "Repasar el tema 3", startDate: hoy.toISOString(), status: "today" }),
    makeTask({ id: mid("pl2"), title: "Mandar el correo al tutor", startDate: hoy.toISOString(), status: "done" }),
  ];
  return (
    <div className="w-full max-w-sm">
      <TaskPlanningMobileView
        weekDates={semana}
        weekOffset={0}
        monthHeading={format(hoy, "MMMM yyyy", { locale: es })}
        weekNumber={42}
        singleDayTasks={tareas}
        multiDayTasks={[]}
        struck={new Set([tareas[1]!.id])}
        onPrevWeek={noop}
        onNextWeek={noop}
        onResetWeek={noop}
        onToggle={noop}
        onDelete={noop}
        onEdit={noop}
        onMoveToDay={noop}
      />
    </div>
  );
}

/** El mes con el dedo: la rejilla en tinta y la agenda con la fila común. */
function MesSpecimen() {
  const [mes, setMes] = useState(() => new Date());
  const dias = eachDayOfInterval({ start: startOfWeek(startOfMonth(mes), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }) });
  const hoy = format(new Date(), "yyyy-MM-dd");
  return (
    <div className="w-full max-w-sm">
      <TaskCalendarMobileView
        month={mes}
        onMonthChange={(f) => setMes(f)}
        days={dias}
        byDay={new Map([[hoy, [makeTask({ id: mid("m1"), title: "Entregar el ensayo", dueDate: daysFromNow(0) })]]])}
        withoutDate={[makeTask({ id: mid("m2"), title: "Pedir la carta de recomendación" })]}
        onNavigateToAction={noop}
      />
    </div>
  );
}

const VENCIDAS = [
  makeTask({ id: mid("o1"), title: "Entregar práctica 4", dueDate: daysFromNow(-2) }),
  makeTask({ id: mid("o2"), title: "Pagar matrícula", dueDate: daysFromNow(-5), priority: "critical", status: "done" }),
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
      title="Tareas: la fila, la página y sus hojas"
      description="Una sola fila de tarea con tres densidades (plan, lista, compacta) para Hoy, /tasks, las vistas de sistema y Planificación; la página de Tareas con su segmento Lista o Calendario; las hojas que reemplazan menús y arrastre en el teléfono; los pickers que editan una tarea."
    >
      <SubSection title="Títulos completos y ciclos académicos" description="Cards con altura natural y árbol de años, ciclos y materias.">
        <Specimen label="Título largo en Acción y Planificación">
          <div className="max-w-3xl">
            <DefaultTaskCard task={makeTask({ title: "Bajar de la PVA: informaciones generales y el desglose del primer mes", priority: "high" })} systemId={MOCK_SYSTEM_ID} onToggle={noop} onDelete={noop} onEdit={noop} />
            <div className="mt-4 max-w-48"><PlanningTaskCard task={makeTask({ title: "Bajar de la PVA: informaciones generales y el desglose del primer mes" })} onToggle={noop} onDelete={noop} onEdit={noop} /></div>
          </div>
        </Specimen>
        <Seeded stubs={[
          seedQuery(api.academicPeriods.list, ACADEMIC_PERIODS),
          seedQuery(api.folders.bySystem, [{ ...makeFolder({ name: "Inteligencia de Negocios" }), academicPeriodId: "cycle-current" }]),
        ]}>
          <Specimen label="Selector de año y ciclo" hint="Vive en la cabecera del sistema. Un filtro de una línea: cambia lo que ves sin pedirle la página al servidor.">
            <Suspense fallback={<div className="h-10" />}>
              <CyclePicker system={makeSystem({ templateType: "academic" })} initialPeriods={ACADEMIC_PERIODS} />
            </Suspense>
          </Specimen>
          <Specimen label="Tarjeta de clase" hint="La rejilla de apuntes de un sistema académico. Dice quién la da, cuándo se ve y qué está por entregar.">
            <Suspense fallback={<div className="h-32" />}>
              <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
                <ClassCard
                  folder={{ ...makeFolder({ name: "Inteligencia de Negocios" }), metadata: { professor: "Prof. Rodríguez", schedule: "Lun y Mie 9:00" }, subfolderCount: 0, pageCount: 9 }}
                  systemId={MOCK_SYSTEM_ID}
                  periods={ACADEMIC_PERIODS}
                  tasks={[makeTask({ title: "Práctica 4", dueDate: daysFromNow(-1) }), makeTask({ title: "Parcial 2", dueDate: daysFromNow(6) })]}
                  href="#"
                />
                <ClassCard
                  folder={{ ...makeFolder({ name: "Seminario de Investigación Aplicada a la Ingeniería de Software" }), metadata: {}, subfolderCount: 0, pageCount: 0 }}
                  systemId={MOCK_SYSTEM_ID}
                  periods={ACADEMIC_PERIODS}
                  tasks={[]}
                  href="#"
                />
              </div>
            </Suspense>
          </Specimen>
        </Seeded>
      </SubSection>
      <SubSection
        title="TaskRow"
        description="La fila de tarea común. El círculo de 48 px en el margen; vencida es la palabra en coral delante de la fecha; crítica y alta son peso, no color; hecha es --ok y el título tachado. Las acciones salen en una hoja en el teléfono y en un menú en escritorio."
      >
        <div className="max-w-2xl">
          <Specimen label="plan" hint="Hoy y lo sugerido: título en 600, duración en la cola">
            <div className="w-full">
              <TaskRow
                task={makeTask({ id: mid("r1"), title: "Parcial de Cálculo III", priority: "critical", effectivePriority: "critical", dueDate: daysFromNow(-3), estimatedTime: "01:30" })}
                density="plan"
                onComplete={noop}
                onOpen={noop}
                actions={[
                  { label: "Iniciar timer", icon: Play, onSelect: noop },
                  { label: "Mover a mañana", icon: CalendarArrowUp, onSelect: noop },
                  { label: "Quitar del plan", icon: X, onSelect: noop },
                ]}
              />
              <TaskRow
                task={makeTask({ id: mid("r2"), title: "Tachada en esta visita: se queda en su sitio", status: "done", estimatedTime: "00:45" })}
                density="plan"
                struck
                onComplete={noop}
                actions={[{ label: "Iniciar timer", icon: Play, onSelect: noop }]}
              />
            </div>
          </Specimen>
          <Specimen label="lista" hint="/tasks y las vistas de sistema: el sistema en la meta, título en 500">
            <div className="w-full">
              <TaskRow
                task={makeTask({ id: mid("r3"), title: "Preparar la presentación del proyecto final", priority: "high", effectivePriority: "high", dueDate: daysFromNow(2) })}
                context="Universidad"
                onComplete={noop}
                onOpen={noop}
                actions={[
                  { label: "Seleccionar", icon: ListChecks, onSelect: noop },
                  { label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: noop },
                ]}
                selection={{ selected: false, visible: false, onToggle: noop }}
              />
              <TaskRow
                task={makeTask({ id: mid("r4"), title: "Fila seleccionada: la casilla en tinta", energyLevel: "low" })}
                context="Casa y salud"
                onComplete={noop}
                onOpen={noop}
                selection={{ selected: true, visible: true, onToggle: noop }}
              />
              <TaskRow
                task={makeTask({ id: mid("r5"), title: "Fila con el foco del teclado (j y k)" })}
                context="Universidad"
                focused
                onComplete={noop}
                onOpen={noop}
              />
            </div>
          </Specimen>
          <Specimen label="compacta" hint="columnas estrechas: título en text-sm, sin cola, margen estrecho con ratón">
            <div className="grid w-full grid-cols-2 gap-4 sm:max-w-md">
              <PlanningTaskCard task={makeTask({ id: mid("r6"), title: "Leer el capítulo 4", dueDate: daysFromNow(1) })} onToggle={noop} onDelete={noop} onEdit={noop} />
              <PlanningTaskCard task={makeTask({ id: mid("r7"), title: "Examen parcial", taskType: "event", dueDate: daysFromNow(-1) })} onToggle={noop} onDelete={noop} onEdit={noop} />
            </div>
          </Specimen>
        </div>
      </SubSection>

      <SubSection
        title="Página de Tareas"
        description="El segmento Lista o Calendario (la segunda puerta del teléfono al calendario), lo sugerido con el presupuesto, y el esqueleto que reserva las alturas de verdad."
      >
        <TasksPageSpecimens />
      </SubSection>

      <SubSection
        title="Hojas de Tareas"
        description="Lo que en escritorio era menú, select o arrastre, en el teléfono es una hoja con operaciones con nombre en renglones de 48 px."
      >
        <TasksSheetsSpecimens />
      </SubSection>

      <SubSection
        title="Detalle de tarea"
        description="Cada dato es un renglón de margen: el rótulo en el margen, en versalitas de mute, y el valor en la columna de texto sin caja. Prioridad, energía, carpeta, ciclo y repetición son fichas en tinta de 48 px; las fechas y los avisos se abren en una hoja en el teléfono. Completar y el foco van en el pie, pegado abajo."
      >
        <DetalleRenglonesSpecimen />
      </SubSection>

      <SubSection
        title="Todas las tareas"
        description="Filtros abre la hoja con la cuenta viva, Limpiar y Ver N tareas; Seleccionar enseña las casillas de todas las filas; las fichas dicen el valor que quitan; la barra de la selección se pega al pie. Mover a la papelera no pregunta: el aviso trae Deshacer."
      >
        <Seeded stubs={[seedQuery(api.tasks.list, { items: LISTA, restantes: 0 })]}>
          <div className="w-full max-w-2xl">
            {/* AllTasksList reads the URL filters; a static page prerenders it only inside Suspense. */}
            <Suspense>
              <AllTasksList systems={[{ id: MOCK_SYSTEM_ID, name: "Universidad", color: "blue" }]} />
            </Suspense>
          </div>
        </Seeded>
      </SubSection>

      <SubSection
        title="Acción, Planificación y el mes con el dedo"
        description="Con el dedo (teléfono o tableta: lo decide el puntero, no el ancho) no hay arrastre. Acción son secciones por columna con Mover a otra columna; Planificación es un día a la vez con Mover a otro día; el mes es la rejilla en tinta con la agenda del día. Completar tacha la fila en su sitio con Deshacer."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Acción" hint="por energía; la segunda está tachada en esta visita" className="items-stretch">
            <KanbanSeccionesSpecimen />
          </Specimen>
          <Specimen label="Planificación" hint="el día elegido en tinta, hoy en ámbar de texto, sin hueco entre días" className="items-stretch">
            <PlanificacionSpecimen />
          </Specimen>
          <Specimen label="Mes" hint="puntos neutros, sin color de prioridad" className="items-stretch">
            <MesSpecimen />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Papelera" description="Una sección de Diario: título con la cuenta, fila de margen por tarea, Restaurar en la cola.">
        <Seeded stubs={[seedQuery(api.tasks.list, { items: [makeTask({ id: mid("tr1"), title: "Borrador viejo del ensayo", deletedAt: daysFromNow(-1) })], restantes: 0 })]}>
          <div className="w-full max-w-2xl">
            <TaskTrashSection systemId={MOCK_SYSTEM_ID} />
          </div>
        </Seeded>
      </SubSection>

      <SubSection
        title="OverdueGroup"
        description="Las vencidas como su propia sección: el título pliega, Mover todas abre una hoja con los tres destinos. La segunda está tachada en esta visita: se queda en su renglón."
      >
        <div className="max-w-2xl">
          <OverdueGroup
            tasks={VENCIDAS}
            filas={VENCIDAS}
            struck={new Set([VENCIDAS[1]!.id])}
            systemMap={SYSTEM_MAP}
            onOpen={noop}
            onComplete={noop}
          />
        </div>
      </SubSection>

      <SubSection
        title="PlanningTaskCard"
        description="La fila compacta de la semana de Planificación."
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
        title="Board kanban (project): BoardCard y SprintBar"
        description="El ticket arrastrable del board, ahora la fila de tarea común con sus acciones con nombre (foco, mover a otra columna, subtareas, papelera), con el badge de estancamiento («Xd sin avanzar») y la barra de ciclos con filtro. Columnas: Por hacer, En progreso, En review, Hecho."
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
                  onRequestMove={noop}
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
                  onRequestMove={noop}
                />
              </div>
            </DndContext>
          </ClientOnly>
        </div>
      </SubSection>

      <SubSection
        title="CaptureRow"
        description="Una captura sin confirmar, en la misma lista que las tareas de Bandeja: misma fila, marca de acento a la izquierda y el glifo de su tipo en el hueco que la fila ya reservaba."
      >
        <div className="max-w-md overflow-hidden rounded-lg border border-border px-3">
          <ul>
            <CaptureRow captura={CAPTURA_CON_ITEMS} onOpen={noop} />
            <CaptureRow captura={CAPTURA_POR_CADUCAR} onOpen={noop} />
            <CaptureRow
              captura={{
                ...CAPTURA_POR_CADUCAR,
                id: mid("cap-3"),
                kind: "voice",
                url: null,
                durationSeconds: 47,
                status: "expired",
                avisa: false,
              }}
              onOpen={noop}
            />
          </ul>
        </div>
      </SubSection>

      <SubSection
        title="BulkActionBar"
        description="La selección múltiple: la cuenta en tinta y operaciones con nombre en botones de 48 px. Fechar y Prioridad abren una hoja."
      >
        <div className="max-w-2xl">
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
          <Specimen label="RecurrencePicker" hint="fichas en tinta; Otra regla abre el campo RRULE" className="items-stretch">
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
