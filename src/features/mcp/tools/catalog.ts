import { z } from "zod";
import { api } from "@convex/_generated/api";
import { ENTITY_TYPES } from "@/features/entities/entities.attributes";
import { TEMPLATE_TYPE_VALUES } from "@/shared/types/enums";
import { htmlToMarkdown, markdownToHtml } from "../markdown";
import { readTool, writeTool, type Tool } from "./define";

/**
 * Las tools que el agente ve, una por función de Convex que merece la pena
 * exponer. Aquí vive sólo lo que es del MCP: el nombre, la prosa que el
 * agente lee para decidir cuándo usarla y, cuando hace falta, el ajuste entre
 * lo que el agente escribe (markdown) y lo que la función guarda (HTML).
 *
 * Las sesiones de aprendizaje no están aquí: son secuencias sobre varias
 * funciones y viven en `learning.ts`.
 */

// Los ids de Convex son strings opacos. Los schemas de Convex usan `zid()`, que
// no tiene forma en JSON Schema, así que aquí se describen de nuevo con string.
const id = z.string().min(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Fecha ISO 8601 inválida");
const TASK_STATUS = z.enum(["backlog", "week", "tomorrow", "today", "done"]);
const PRIORITY = z.enum(["critical", "high", "medium", "low"]);
const ENERGY = z.enum(["high", "medium", "low"]);
const TASK_TYPE = z.enum(["task", "idea", "event", "reminder", "epic"]);
/** 'HH:MM' o 'HH:MM:SS'. */
const clock = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato HH:MM");
const taskMetadata = z.object({ eventSubtype: z.enum(["exam", "quiz", "practice"]).optional() }).catchall(z.unknown());

/** Espejo de `createTaskSchema` en Convex, que es quien valida las reglas cruzadas. */
const createTask = z.object({
  systemId: id,
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: TASK_STATUS.optional(),
  energyLevel: ENERGY.optional(),
  priority: PRIORITY.optional(),
  taskType: TASK_TYPE.optional(),
  dueDate: isoDate.optional(),
  startDate: isoDate.optional(),
  estimatedTime: clock.optional(),
  parentTaskId: id.optional(),
  contextTagId: id.optional(),
  folderId: id.optional(),
  sprintId: id.optional(),
  boardStatus: z.string().max(50).optional(),
  recurrenceRule: z.string().max(500).nullable().optional().describe("Regla RRULE (RFC 5545)"),
  metadata: taskMetadata.optional(),
});

const updateTask = z.object({
  id,
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: TASK_STATUS.optional(),
  energyLevel: ENERGY.optional(),
  priority: PRIORITY.optional(),
  taskType: TASK_TYPE.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  estimatedTime: clock.optional(),
  parentTaskId: id.optional(),
  contextTagId: id.nullable().optional(),
  folderId: id.nullable().optional(),
  sprintId: id.nullable().optional(),
  systemId: id.optional(),
  inTodayPlan: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  metadata: taskMetadata.nullable().optional(),
});

/** El agente escribe markdown; la página guarda el HTML que el editor renderiza. */
function withHtmlContent<T extends { content?: string | null }>(input: T): Omit<T, "content"> & { content?: string | null } {
  const { content, ...rest } = input;
  return content === undefined ? rest : { ...rest, content: markdownToHtml(content) };
}

/**
 * Y el viaje de vuelta: la página se lee en markdown, no en el HTML con el que
 * está guardada. `updatedAt` se queda tal cual porque es la versión que
 * `update_page` espera de vuelta en `expectedUpdatedAt`.
 */
function asMarkdownPage<T extends { content: string | null }>(page: T) {
  return { ...page, content: htmlToMarkdown(page.content), contentFormat: "markdown" as const };
}

const pageContent = z.string().nullable().optional().describe("Contenido en markdown; se convierte a HTML al guardar para que el editor lo renderice");

// ── Energía ──────────────────────────────────────────────────────────────────

const energy: Tool[] = [
  readTool(api.energy.checkins, {
    name: "get_energy_checkin",
    description: "Obtiene los check-ins de energía del usuario de hoy (nivel y calidad de sueño), si ya registró alguno.",
    input: z.object({}),
  }),
  writeTool(api.energy.createCheckin, {
    name: "create_energy_checkin",
    description: "Registra el check-in de energía del usuario para hoy. currentLevel es 1-100 y sleepQuality es good/partial/poor.",
    input: z.object({
      currentLevel: z.number().int().min(1).max(100),
      sleepQuality: z.enum(["good", "partial", "poor"]).optional(),
      slot: z.enum(["morning", "afternoon", "evening"]).optional(),
    }),
  }),
  readTool(api.energy.todayPlan, {
    name: "get_today_plan",
    description: "Obtiene el plan de energía de hoy: tareas recomendadas ajustadas al nivel de energía y límite diario del usuario.",
    input: z.object({}),
  }),
  readTool(api.energy.windows, {
    name: "get_energy_windows",
    description:
      "Ventanas de energía del usuario y presupuesto del día: cronotipo, curva (aprendida o teórica), ventana pico, capacidad media por tramo (mañana/tarde/noche), predicción guardada de hoy y energía comprometida vs. límite. Úsalo ANTES de proponer o mover bloques. Si peak es null, Kino todavía no aprendió la curva: no inventes una mejor ventana.",
    input: z.object({}),
  }),
  readTool(api.energy.blockProposal, {
    name: "propose_day_blocks",
    description:
      "Propone bloques horarios para un día usando el mismo planificador que ve el usuario: coloca lo exigente en los tramos de más energía, sugiere pausas cada ~90 min y explica por qué cada tarea va donde va. NO escribe nada: devuelve la propuesta y las tareas que quedaron fuera con su motivo (budget = no cabe en el día, energy = pide más energía de la proyectada). Para escribirla usa schedule_task_block.",
    input: z.object({
      date: day.optional().describe("Día local del usuario; hoy si se omite"),
      startHour: z.number().int().min(0).max(23).optional().describe("Hora a la que empieza el día planificado; 9 si se omite"),
    }),
  }),
  writeTool(api.energy.scheduleBlock, {
    name: "schedule_task_block",
    description:
      "Coloca (o mueve) el bloque de una tarea en un día y hora locales del usuario. El bloque no es una entidad aparte: es la tarea programada en el calendario global. Devuelve qué tan bien encaja esa hora con la curva de energía y avisa si el día queda en sobregiro; el sobregiro nunca impide la operación.",
    input: z.object({ taskId: id, date: day, hour: z.number().int().min(0).max(23) }),
  }),
  writeTool(api.energy.clearBlock, {
    name: "clear_task_block",
    description:
      "Saca una tarea del calendario (elimina su programación) sin tocar su fecha límite. Los eventos no pueden quedarse sin fecha de inicio: para un evento, muévelo de hora con schedule_task_block.",
    input: z.object({ taskId: id }),
  }),
  readTool(api.energy.weeklyRitual, {
    name: "get_weekly_ritual",
    description:
      "Estado del ritual de revisión semanal: tareas vencidas y en qué día de los próximos siete caben según el presupuesto de energía de cada día, con las que no tienen lugar y por qué. No escribe nada. isReviewDay indica si hoy es el día de revisión que el usuario eligió.",
    input: z.object({}),
  }),
  writeTool(api.energy.applyWeeklyRitual, {
    name: "apply_weekly_ritual",
    description:
      "Aplica el reparto de la revisión semanal: reprograma cada tarea al día indicado (cambia su programación, NUNCA su fecha límite). Normalmente se llama con las asignaciones que devolvió get_weekly_ritual, quitando las que el usuario no quiera. Devuelve las aplicadas y las que fallaron.",
    input: z.object({ assignments: z.array(z.object({ taskId: id, date: day })).min(1).max(100) }),
  }),
];

// ── Codex (entidades) ────────────────────────────────────────────────────────

const entityFields = {
  aliases: z.array(z.string().trim().min(1).max(255)).max(50).optional(),
  summary: z.string().max(1000).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).nullable().optional(),
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  images: z.array(z.string().url().max(2048)).max(100).optional(),
};

const entities: Tool[] = [
  readTool(api.entities.bySystem, {
    name: "list_entities",
    description: "Lista el codex de un sistema de escritura: todos los personajes, lugares, objetos y conceptos del universo, con sus alias y resumen.",
    input: z.object({ systemId: id }),
  }),
  readTool(api.entities.byId, {
    name: "get_entity",
    description: "Obtiene la ficha completa de una entidad del codex: atributos, relaciones y en qué capítulos aparece (con la primera aparición).",
    input: z.object({ id }),
  }),
  writeTool(api.entities.create, {
    name: "create_entity",
    description: "Crea una entidad en el codex de un sistema de escritura (personaje, lugar, objeto…).",
    input: z.object({ systemId: id, type: z.enum(ENTITY_TYPES), name: z.string().trim().min(1).max(255), ...entityFields }),
  }),
  writeTool(api.entities.update, {
    name: "update_entity",
    description: "Actualiza una entidad del codex: nombre, tipo, alias, resumen o atributos.",
    input: z.object({ id, type: z.enum(ENTITY_TYPES).optional(), name: z.string().trim().min(1).max(255).optional(), ...entityFields }),
  }),
  writeTool(api.entities.createRelation, {
    name: "link_entities",
    description: 'Crea una relación entre dos entidades del codex ("padre de", "rival de", "vive en"). La dirección va de fromEntityId a toEntityId.',
    input: z.object({
      fromEntityId: id,
      toEntityId: id,
      label: z.string().trim().max(100).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
    }),
    args: ({ fromEntityId, ...rest }) => ({ id: fromEntityId, ...rest }),
  }),
];

// ── Carpetas ─────────────────────────────────────────────────────────────────

const folderMetadata = z.record(z.string(), z.unknown()).nullish().describe("Campos del rol de carpeta según el arquetipo del sistema; el servidor los valida");

const folders: Tool[] = [
  readTool(api.folders.bySystem, {
    name: "list_folders",
    description: "Lista las carpetas de un sistema en Kino (jerarquía de organización de tareas y páginas).",
    input: z.object({ systemId: id }),
  }),
  readTool(api.folders.children, {
    name: "get_folder_children",
    description: "Lista las subcarpetas directas de una carpeta padre en Kino.",
    input: z.object({ id: id.describe("Carpeta padre") }),
  }),
  writeTool(api.folders.create, {
    name: "create_folder",
    description:
      "Crea una carpeta en un sistema de Kino. Puede anidarse bajo otra carpeta con parentId. Según el arquetipo del sistema, la carpeta es una clase (Academic: professor/schedule/semester), un milestone (Entrepreneurial: targetDate) o un área; esos campos van en metadata y el servidor los valida.",
    input: z.object({ systemId: id, name: z.string().min(1).max(255), color: z.string().optional(), parentId: id.optional(), metadata: folderMetadata }),
  }),
  writeTool(api.folders.update, {
    name: "update_folder",
    description: "Actualiza el nombre, color o metadata (campos del rol de carpeta según el arquetipo) de una carpeta en Kino.",
    input: z.object({ id, name: z.string().min(1).max(255).optional(), color: z.string().optional(), metadata: folderMetadata }),
  }),
  writeTool(api.folders.remove, {
    name: "delete_folder",
    description: "Elimina una carpeta de Kino.",
    input: z.object({ id }),
  }),
];

// ── Insights ─────────────────────────────────────────────────────────────────

const taskText = z.object({ title: z.string().trim().min(1), description: z.string().optional() });

const insights: Tool[] = [
  readTool(api.insights.context, {
    name: "get_user_context",
    description:
      "Returns a full snapshot of the user's Kino state: systems, today's tasks, current energy level, and the top behavioral pattern detected. Use this as a first call before reasoning about tasks.",
    input: z.object({}),
  }),
  readTool(api.insights.patterns, {
    name: "detect_patterns",
    description:
      "Analyzes recent behavior and returns the most urgent productivity pattern detected (overload, abandonment, disorganization, or underuse) along with a suggested corrective action.",
    input: z.object({}),
  }),
  readTool(api.insights.energyDistribution, {
    name: "get_energy_distribution",
    description: "Returns how much cognitive energy the user has spent per system over the last N days. Useful to detect imbalances (e.g. one system consuming 80% of energy).",
    input: z.object({ days: z.number().int().min(1).max(90).optional().describe("7 si se omite") }),
  }),
  readTool(api.insights.suggest, {
    name: "suggest_next_action",
    description: "Returns the top N tasks the user should work on next, ranked by importance score (priority + urgency + age).",
    input: z.object({ limit: z.number().int().min(1).max(10).optional().describe("10 si se omite") }),
  }),
  readTool(api.insights.suggest, {
    name: "reorder_by_importance",
    description:
      "Devuelve las tareas de hoy ordenadas por importancia (prioridad × urgencia × antigüedad). Úsalo cuando el usuario pregunte por dónde empezar o qué es lo más importante, no para listar tareas; para eso está list_tasks.",
    input: z.object({}),
    args: () => ({ limit: 10 }),
  }),
  readTool(api.insights.staleSystems, {
    name: "find_stale_systems",
    description: "Returns systems with no activity (no task completed and no time logged) in the last N days. Helps identify abandoned projects or areas.",
    input: z.object({ days: z.number().int().min(1).max(180).optional().describe("14 si se omite") }),
  }),
  readTool(api.insights.classify, {
    name: "classify_task",
    description:
      'Suggests the best system and priority for a task based on its title and description. Uses keyword matching against the user\'s systems. Confidence can be "high", "medium", or "low".',
    input: taskText,
  }),
  readTool(api.insights.estimate, {
    name: "estimate_task",
    description:
      "Estima el nivel de energía (high/medium/low) y el tiempo que tomará una tarea a partir de su título y descripción. Úsalo ANTES de crear una tarea cuando el usuario no dijo cuánta energía o cuánto tiempo requiere, para rellenar esos campos con un valor por defecto razonable. Es una heurística de keywords, no un juicio: si el usuario dio su propia estimación, la suya manda.",
    input: taskText,
  }),
  readTool(api.insights.decompose, {
    name: "generate_subtasks",
    description:
      'Prepara la descomposición de una tarea compleja: devuelve la tarea, las subtareas que ya tiene y las reglas de Kino para partirla bien. Úsalo cuando el usuario pida dividir, descomponer o "hacer más manejable" una tarea. TÚ redactas las subtareas a partir de lo que devuelve, respetando `guidance` y el formato de `outputContract`; después llama a bulk_create_tasks con los valores que vienen en `outputContract.thenCallWith` para crearlas. Muéstraselas al usuario antes de crearlas.',
    input: z.object({ taskId: id, count: z.number().int().min(1).max(10).optional() }),
  }),
];

// ── Páginas ──────────────────────────────────────────────────────────────────

const pages: Tool[] = [
  readTool(api.pages.bySystem, {
    name: "list_pages",
    description: "Lista las páginas (notas markdown) de un sistema en Kino.",
    input: z.object({ systemId: id }),
  }),
  readTool(api.pages.byId, {
    name: "get_page",
    description:
      "Obtiene una página de Kino completa: título, contenido en markdown y tareas vinculadas. Devuelve también `updatedAt`, que es la versión que hay que pasarle a update_page para no pisar una edición posterior.",
    input: z.object({ id }),
    result: asMarkdownPage,
  }),
  writeTool(api.pages.create, {
    name: "create_page",
    description: "Crea una página markdown en un sistema de Kino.",
    input: z.object({
      systemId: id,
      folderId: id.optional(),
      parentPageId: id.optional(),
      title: z.string().max(500).optional(),
      content: pageContent,
    }),
    args: withHtmlContent,
  }),
  writeTool(api.pages.update, {
    name: "update_page",
    description:
      "Actualiza una página de Kino: título, contenido markdown, carpeta o estado de pin. El contenido se reemplaza entero, así que para editar hay que leer la página primero con get_page.",
    input: z.object({
      id,
      title: z.string().max(500).nullable().optional(),
      content: pageContent,
      folderId: id.nullable().optional(),
      isPinned: z.boolean().optional(),
      expectedUpdatedAt: z.iso
        .datetime({ offset: true })
        .optional()
        .describe(
          "El `updatedAt` que devolvió la última lectura. Si la página cambió desde entonces la escritura falla con CONFLICT en vez de pisarla: vuelve a leerla, aplica el cambio sobre lo nuevo y reintenta. Mándalo siempre que estés reescribiendo contenido.",
        ),
    }),
    args: withHtmlContent,
    result: asMarkdownPage,
  }),
  writeTool(api.pages.remove, {
    name: "delete_page",
    description: "Elimina (soft-delete) una página de Kino.",
    input: z.object({ id }),
  }),
  writeTool(api.pages.linkTask, {
    name: "link_task_to_page",
    description: "Vincula una tarea existente a una página de Kino (relación de referencia, no cambia la ubicación de la tarea).",
    input: z.object({ id: id.describe("Página"), taskId: id }),
  }),
  writeTool(api.pages.unlinkTask, {
    name: "unlink_task_from_page",
    description: "Desvincula una tarea de una página de Kino (no elimina la tarea).",
    input: z.object({ id: id.describe("Página"), taskId: id }),
  }),
  readTool(api.pages.linkedTasks, {
    name: "list_page_tasks",
    description: "Lista las tareas vinculadas a una página de Kino.",
    input: z.object({ id: id.describe("Página") }),
  }),
];

// ── Notas adhesivas ──────────────────────────────────────────────────────────

const noteFields = {
  title: z.string().max(200).optional(),
  content: z.string().max(500).optional(),
  color: z.string().optional(),
};

const stickyNotes: Tool[] = [
  readTool(api.stickyNotes.byFolder, {
    name: "list_folder_sticky_notes",
    description: "Lista las notas adhesivas (sticky notes) ancladas a una carpeta en Kino.",
    input: z.object({ folderId: id }),
  }),
  readTool(api.stickyNotes.byPage, {
    name: "list_page_sticky_notes",
    description: "Lista las notas adhesivas (sticky notes) ancladas a una página en Kino.",
    input: z.object({ pageId: id }),
  }),
  writeTool(api.stickyNotes.createOnFolder, {
    name: "create_folder_sticky_note",
    description: "Crea una nota adhesiva (sticky note) anclada a una carpeta en Kino.",
    input: z.object({ folderId: id, ...noteFields }),
  }),
  writeTool(api.stickyNotes.createOnPage, {
    name: "create_page_sticky_note",
    description: "Crea una nota adhesiva (sticky note) anclada a una página en Kino.",
    input: z.object({ pageId: id, ...noteFields }),
  }),
  writeTool(api.stickyNotes.update, {
    name: "update_sticky_note",
    description: "Actualiza el título, contenido o color de una nota adhesiva en Kino.",
    input: z.object({ id, title: z.string().max(200).nullable().optional(), content: z.string().max(500).nullable().optional(), color: z.string().optional() }),
  }),
  writeTool(api.stickyNotes.remove, {
    name: "delete_sticky_note",
    description: "Elimina una nota adhesiva de Kino.",
    input: z.object({ id }),
  }),
];

// ── Sistemas ─────────────────────────────────────────────────────────────────

const systemFields = {
  identityStatement: z.string().max(500).optional(),
  templateType: z.enum(TEMPLATE_TYPE_VALUES).optional(),
  energyIdeal: ENERGY.optional(),
  icon: z.string().max(50).optional(),
  expectedFrequency: z.string().max(20).optional(),
  triggerContext: z.string().max(255).optional(),
};

const systems: Tool[] = [
  readTool(api.systems.list, {
    name: "list_systems",
    description: "Lista todos los sistemas del usuario en Kino (proyectos, áreas, etc.).",
    input: z.object({}),
  }),
  writeTool(api.systems.create, {
    name: "create_system",
    description: "Crea un nuevo sistema (proyecto o área) en Kino.",
    input: z.object({ name: z.string().min(1).max(255), color: z.string(), ...systemFields }),
  }),
  writeTool(api.systems.update, {
    name: "update_system",
    description: "Actualiza propiedades de un sistema existente en Kino (nombre, color, ícono, propósito, etc.).",
    input: z.object({ id, name: z.string().min(1).max(255).optional(), color: z.string().optional(), ...systemFields }),
  }),
  writeTool(api.systems.remove, {
    name: "delete_system",
    description: "Desactiva (soft-delete) un sistema en Kino. No puede eliminarse el Inbox.",
    input: z.object({ id }),
  }),
];

// ── Tareas ───────────────────────────────────────────────────────────────────

const tasks: Tool[] = [
  readTool(api.tasks.list, {
    name: "list_tasks",
    description: "Lista tareas del usuario en Kino con filtros opcionales.",
    input: z.object({
      systemId: id.optional(),
      energyLevel: ENERGY.optional(),
      status: TASK_STATUS.optional(),
      deleted: z.boolean().optional().describe("Con true lista la papelera en vez de las activas"),
    }),
  }),
  readTool(api.tasks.byId, {
    name: "get_task",
    description: "Obtiene el detalle completo de una tarea por su ID.",
    input: z.object({ id }),
  }),
  readTool(api.tasks.subtasks, {
    name: "get_subtasks",
    description: "Lista las subtareas de una tarea padre.",
    input: z.object({ id: id.describe("Tarea padre") }),
  }),
  readTool(api.tasks.byFolder, {
    name: "list_folder_tasks",
    description: "Lista las tareas asignadas directamente a una carpeta de un sistema.",
    input: z.object({ systemId: id, folderId: id }),
  }),
  writeTool(api.tasks.create, {
    name: "create_task",
    description:
      'Crea una tarea en Kino. REGLA DE STATUS: Si no se especifica startDate ni status, usa status="week" para que la tarea aparezca en la Action View (vista principal). Solo usa status="backlog" para ideas o trabajo sin fecha. Si tienes una fecha de inicio, pásala en startDate y el status se derivará automáticamente. RECORDATORIOS: Si la tarea tiene dueDate, Kino enviará notificaciones push automáticamente (día anterior y día del vencimiento), siempre que el usuario tenga push habilitado.',
    input: createTask,
  }),
  writeTool(api.tasks.bulkCreate, {
    name: "bulk_create_tasks",
    description:
      "Crea múltiples tareas en Kino en una sola operación (máximo 50). Para crear SUBTAREAS de una tarea padre, define parentTaskId en cada item (todas pueden apuntar al mismo padre). Útil tras generate_subtasks.",
    input: z.object({ tasks: z.array(createTask).min(1).max(50) }),
  }),
  writeTool(api.tasks.update, {
    name: "update_task",
    description: "Actualiza campos de una tarea existente en Kino.",
    input: updateTask,
  }),
  writeTool(api.tasks.remove, {
    name: "delete_task",
    description: "Elimina una tarea de Kino (borrado lógico: la tarea queda en papelera, no se destruye).",
    input: z.object({ id }),
    result: (removed) => `Tarea "${removed.title}" (${removed.id}) eliminada correctamente.`,
  }),
  writeTool(api.tasks.restore, {
    name: "restore_task",
    description: "Restaura una tarea previamente eliminada (soft-delete) en Kino, devolviéndola de la papelera al estado activo.",
    input: z.object({ id }),
  }),
  writeTool(api.tasks.toggle, {
    name: "complete_task",
    description: "Marca una tarea como completada (o la descompleta si ya estaba hecha).",
    input: z.object({ id }),
  }),
  writeTool(api.tasks.move, {
    name: "move_task",
    description: "Mueve una tarea a un estado diferente (backlog, week, tomorrow, today, done).",
    input: z.object({ id, status: TASK_STATUS }),
  }),
  writeTool(api.tasks.bulkMove, {
    name: "bulk_move_tasks",
    description: "Mueve múltiples tareas al mismo estado en una sola operación (máximo 50).",
    input: z.object({ taskIds: z.array(id).min(1).max(50), status: TASK_STATUS }),
  }),
  writeTool(api.tasks.bulkUpdate, {
    name: "bulk_update_tasks",
    description: "Actualiza la prioridad de múltiples tareas en una sola operación (máximo 50).",
    input: z.object({ taskIds: z.array(id).min(1).max(50), priority: PRIORITY.optional() }),
  }),
  writeTool(api.tasks.moveBoard, {
    name: "move_task_board",
    description:
      'Mueve una tarjeta a otra columna del board kanban (systemType "project"). Columnas por defecto: todo, in_progress, review, done. Mover a la columna terminal (done) completa la tarea automáticamente; sacarla de done la reabre.',
    input: z.object({ id, boardStatus: z.string().min(1).max(50) }),
  }),
  writeTool(api.tasks.createTimeLog, {
    name: "log_task_time",
    description: "Registra una sesión de tiempo trabajada en una tarea (time log). Las fechas van en ISO 8601 UTC.",
    input: z.object({
      id: id.describe("Tarea"),
      systemId: id,
      startedAt: isoDate,
      endedAt: isoDate,
      durationMinutes: z.number().int().min(0),
      source: z.enum(["timer", "manual", "pomodoro"]).optional(),
    }),
  }),
];

// ── Escritura ────────────────────────────────────────────────────────────────

const writing: Tool[] = [
  readTool(api.writing.storySearch, {
    name: "search_story",
    description: "Busca una frase dentro del texto de las obras de un sistema y devuelve los capítulos con fragmentos alrededor de cada coincidencia.",
    input: z.object({ systemId: id, q: z.string().trim().min(1).describe("La frase a buscar") }),
    args: ({ systemId, q }) => ({ id: systemId, q }),
  }),
  readTool(api.writing.structure, {
    name: "get_work_structure",
    description:
      "Estructura de una obra: sus capítulos en orden con palabras, si están terminados y qué entidades del codex aparecen en cada uno. La vista de conjunto para razonar sobre continuidad.",
    input: z.object({ folderId: id.describe("La carpeta de la obra") }),
    args: ({ folderId }) => ({ id: folderId }),
  }),
  readTool(api.writing.timeline, {
    name: "get_timeline",
    description:
      "Cronología in-world de una obra: los eventos del codex ordenados en el tiempo de la historia, con el capítulo donde se cuenta cada uno y cuáles se narran fuera de orden (flashbacks). Los eventos sin ubicar vienen aparte.",
    input: z.object({ folderId: id.describe("La carpeta de la obra") }),
    args: ({ folderId }) => ({ id: folderId }),
  }),
];

export const CATALOG: readonly Tool[] = [...energy, ...entities, ...folders, ...insights, ...pages, ...stickyNotes, ...systems, ...tasks, ...writing];
