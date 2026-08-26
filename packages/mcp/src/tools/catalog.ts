import type { OperationId } from "../generated/operations.js";
import { markdownToHtml } from "../utils/markdown.js";

/**
 * Qué operación de la API es una tool, cómo se llama y qué le cuenta al agente.
 *
 * La forma de cada tool —sus parámetros, su validación y la llamada— sale del
 * contrato, en `../generated/operations.ts`. Aquí sólo vive lo que de verdad es
 * del MCP y no de la ruta: el nombre y la prosa que el agente lee para decidir
 * cuándo usarla.
 *
 * El mapa es exhaustivo sobre `OperationId`: un endpoint nuevo no compila hasta
 * que alguien decide si es una tool o un `null` explícito. Ese era el agujero —
 * añadir un endpoint significaba acordarse de añadir su tool, y nada lo
 * comprobaba.
 */
export interface ToolSpec {
  /** Cómo la llama el agente. */
  readonly name: string;
  /** Para qué sirve y cuándo usarla, en lenguaje natural. */
  readonly description: string;
  /**
   * Prosa por parámetro, sólo donde el nombre no basta. La forma del parámetro
   * ya viene del contrato; esto es la explicación.
   */
  readonly params?: Readonly<Record<string, string>>;
  /** Valores que la tool fija y el agente no elige. */
  readonly fixedInput?: Readonly<Record<string, unknown>>;
  /** Parámetros que no se le ofrecen al agente (los que fija la tool). */
  readonly hiddenParams?: readonly string[];
  /** Último ajuste de la entrada antes de mandarla. */
  readonly prepareInput?: (input: Record<string, unknown>) => Record<string, unknown>;
  /** Qué contestar cuando la operación no devuelve cuerpo. */
  readonly confirmation?: (input: Record<string, unknown>) => string;
}

/** El agente escribe markdown; la página guarda el HTML que el editor renderiza. */
function markdownContent(input: Record<string, unknown>): Record<string, unknown> {
  return typeof input.content === "string"
    ? { ...input, content: markdownToHtml(input.content) }
    : input;
}

export const CATALOG: Readonly<Record<OperationId, ToolSpec | readonly ToolSpec[] | null>> = {
  "account.changeEmail": null,
  "account.changePassword": null,
  "account.overview": null,
  "account.remove": null,
  "account.rename": null,
  "account.revokeOtherSessions": null,
  "account.revokeSession": null,
  "account.sessions": null,
  "apiKeys.create": null,
  "apiKeys.list": null,
  "apiKeys.remove": null,
  "apiKeys.revoke": null,
  "energy.advisor": null,
  "energy.applyWeeklyRitual": { name: "apply_weekly_ritual", description: "Aplica el reparto de la revisión semanal: reprograma cada tarea al día indicado (cambia su programación, NUNCA su fecha límite). Normalmente se llama con las asignaciones que devolvió get_weekly_ritual, quitando las que el usuario no quiera. Devuelve las aplicadas y las que fallaron." },
  "energy.blockProposal": { name: "propose_day_blocks", description: "Propone bloques horarios para un día usando el mismo planificador que ve el usuario: coloca lo exigente en los tramos de más energía, sugiere pausas cada ~90 min y explica por qué cada tarea va donde va. NO escribe nada — devuelve la propuesta y las tareas que quedaron fuera con su motivo (budget = no cabe en el día, energy = pide más energía de la proyectada). Para escribirla usa schedule_task_block." },
  "energy.checkins": { name: "get_energy_checkin", description: "Obtiene el check-in de energía del usuario para hoy (nivel actual y calidad de sueño), si ya lo registró." },
  "energy.clearBlock": { name: "clear_task_block", description: "Saca una tarea del calendario (elimina su programación) sin tocar su fecha límite. Los eventos no pueden quedarse sin fecha de inicio: para un evento, muévelo de hora con schedule_task_block." },
  "energy.createCheckin": { name: "create_energy_checkin", description: "Registra el check-in de energía del usuario para hoy. currentLevel es 1-100 y sleepQuality es good/partial/poor." },
  "energy.scheduleBlock": { name: "schedule_task_block", description: "Coloca (o mueve) el bloque de una tarea en un día y hora locales del usuario. El bloque no es una entidad aparte: es la tarea programada en el calendario global. Devuelve qué tan bien encaja esa hora con la curva de energía y avisa si el día queda en sobregiro — el sobregiro nunca impide la operación." },
  "energy.todayPlan": { name: "get_today_plan", description: "Obtiene el plan de energía de hoy: tareas recomendadas ajustadas al nivel de energía y límite diario del usuario." },
  "energy.updateAccuracy": null,
  "energy.weeklyRitual": { name: "get_weekly_ritual", description: "Estado del ritual de revisión semanal: tareas vencidas y en qué día de los próximos siete caben según el presupuesto de energía de cada día, con las que no tienen lugar y por qué. No escribe nada. isReviewDay indica si hoy es el día de revisión que el usuario eligió." },
  "energy.windows": { name: "get_energy_windows", description: "Ventanas de energía del usuario y presupuesto del día: cronotipo, curva (aprendida o teórica), ventana pico, capacidad media por tramo (mañana/tarde/noche), predicción guardada de hoy y energía comprometida vs. límite. Úsalo ANTES de proponer o mover bloques. Si peak es null, Kino todavía no aprendió la curva: no inventes una mejor ventana." },
  "entities.byId": { name: "get_entity", description: "Obtiene la ficha completa de una entidad del codex: atributos, relaciones y en qué capítulos aparece (con la primera aparición)" },
  "entities.byPage": null,
  "entities.bySystem": { name: "list_entities", description: "Lista el codex de un sistema de escritura: todos los personajes, lugares, objetos y conceptos del universo, con sus alias y resumen" },
  "entities.create": { name: "create_entity", description: "Crea una entidad en el codex de un sistema de escritura (personaje, lugar, objeto…)" },
  "entities.createRelation": { name: "link_entities", description: "Crea una relación entre dos entidades del codex (\"padre de\", \"rival de\", \"vive en\"). La dirección va de fromEntityId a toEntityId" },
  "entities.graph": null,
  "entities.remove": null,
  "entities.removeRelation": null,
  "entities.update": { name: "update_entity", description: "Actualiza una entidad del codex: nombre, tipo, alias, resumen o atributos" },
  "folders.bySystem": { name: "list_folders", description: "Lista las carpetas de un sistema en Kino (jerarquía de organización de tareas y páginas)" },
  "folders.children": { name: "get_folder_children", description: "Lista las subcarpetas directas de una carpeta padre en Kino" },
  "folders.create": { name: "create_folder", description: "Crea una carpeta en un sistema de Kino. Puede anidarse bajo otra carpeta con parentId. Según el arquetipo del sistema, la carpeta es una clase (Academic: professor/schedule/semester), un milestone (Entrepreneurial: targetDate) o un área — esos campos van en metadata y el servidor los valida." },
  "folders.remove": { name: "delete_folder", description: "Elimina una carpeta de Kino" },
  "folders.update": { name: "update_folder", description: "Actualiza el nombre, color o metadata (campos del rol de carpeta según el arquetipo) de una carpeta en Kino" },
  "github.disconnect": null,
  "github.linkRepo": null,
  "github.status": null,
  "github.sync": null,
  "github.unlinkRepo": null,
  "insights.classify": { name: "classify_task", description: "Suggests the best system and priority for a task based on its title and description. Uses keyword matching against the user's systems. Confidence can be \"high\", \"medium\", or \"low\"." },
  "insights.context": { name: "get_user_context", description: "Returns a full snapshot of the user's Kino state: systems, today's tasks, current energy level, and the top behavioral pattern detected. Use this as a first call before reasoning about tasks." },
  "insights.decompose": { name: "generate_subtasks", description: "Prepara la descomposición de una tarea compleja: devuelve la tarea, las subtareas que ya tiene y las reglas de Kino para partirla bien. Úsalo cuando el usuario pida dividir, descomponer o \"hacer más manejable\" una tarea. TÚ redactas las subtareas a partir de lo que devuelve, respetando `guidance` y el formato de `outputContract`; después llama a bulk_create_tasks con los valores que vienen en `outputContract.thenCallWith` para crearlas. Muéstraselas al usuario antes de crearlas." },
  "insights.energyDistribution": { name: "get_energy_distribution", description: "Returns how much cognitive energy the user has spent per system over the last N days. Useful to detect imbalances (e.g. one system consuming 80% of energy)." },
  "insights.estimate": { name: "estimate_task", description: "Estima el nivel de energía (high/medium/low) y el tiempo que tomará una tarea a partir de su título y descripción. Úsalo ANTES de crear una tarea cuando el usuario no dijo cuánta energía o cuánto tiempo requiere, para rellenar esos campos con un valor por defecto razonable. Es una heurística de keywords, no un juicio: si el usuario dio su propia estimación, la suya manda." },
  "insights.patterns": { name: "detect_patterns", description: "Analyzes recent behavior and returns the most urgent productivity pattern detected (overload, abandonment, disorganization, or underuse) along with a suggested corrective action." },
  "insights.staleSystems": { name: "find_stale_systems", description: "Returns systems with no activity (no task completed and no time logged) in the last N days. Helps identify abandoned projects or areas." },
  "insights.suggest": [
    { name: "suggest_next_action", description: "Returns the top N tasks the user should work on next, ranked by importance score (priority + urgency + age). Optionally filter by energy level to match current capacity." },
    { fixedInput: { limit: 10 }, hiddenParams: ["limit"], name: "reorder_by_importance", description: "Devuelve las tareas de hoy ordenadas por importancia (prioridad × urgencia × antigüedad). Úsalo cuando el usuario pregunte por dónde empezar o qué es lo más importante, no para listar tareas — para eso está list_tasks." },
  ],
  "notifications.createReminder": null,
  "notifications.reminders": null,
  "notifications.removeReminder": null,
  "notifications.subscribe": null,
  "notifications.unsubscribe": null,
  "onboarding.complete": null,
  "onboarding.status": null,
  "pages.addTag": null,
  "pages.byId": { name: "get_page", description: "Obtiene el contenido completo de una página (título, markdown, tasks vinculados)" },
  "pages.bySystem": null,
  "pages.create": {
    name: "create_page",
    description: "Crea una página markdown en un sistema de Kino",
    params: {
      content: "Contenido en markdown (se convierte a HTML al guardar para que el editor lo renderice correctamente)",
    },
    prepareInput: markdownContent,
  },
  "pages.createInSystem": null,
  "pages.createSubpage": null,
  "pages.linkTask": { name: "link_task_to_page", description: "Vincula una tarea existente a una página de Kino (relación de referencia, no cambia la ubicación de la tarea)" },
  "pages.linkedTasks": { name: "list_page_tasks", description: "Lista las tareas vinculadas a una página de Kino" },
  "pages.list": { name: "list_pages", description: "Lista las páginas (notas markdown) de un sistema en Kino" },
  "pages.remove": { name: "delete_page", description: "Elimina (soft-delete) una página de Kino" },
  "pages.removeTag": null,
  "pages.subpages": null,
  "pages.tags": null,
  "pages.unlinkTask": { name: "unlink_task_from_page", description: "Desvincula una tarea de una página de Kino (no elimina la tarea)" },
  "pages.update": {
    name: "update_page",
    description: "Actualiza una página de Kino: título, contenido markdown, carpeta o estado de pin",
    params: { content: "Contenido en markdown (se convierte a HTML al guardar)" },
    prepareInput: markdownContent,
  },
  "search.all": null,
  "settings.get": null,
  "settings.update": null,
  "sprints.bySystem": null,
  "sprints.close": null,
  "sprints.create": null,
  "sprints.remove": null,
  "sprints.update": null,
  "stickyNotes.byFolder": { name: "list_folder_sticky_notes", description: "Lista las notas adhesivas (sticky notes) ancladas a una carpeta en Kino" },
  "stickyNotes.byPage": { name: "list_page_sticky_notes", description: "Lista las notas adhesivas (sticky notes) ancladas a una página en Kino" },
  "stickyNotes.createOnFolder": { name: "create_folder_sticky_note", description: "Crea una nota adhesiva (sticky note) anclada a una carpeta en Kino" },
  "stickyNotes.createOnPage": { name: "create_page_sticky_note", description: "Crea una nota adhesiva (sticky note) anclada a una página en Kino" },
  "stickyNotes.remove": { name: "delete_sticky_note", description: "Elimina una nota adhesiva de Kino" },
  "stickyNotes.stack": null,
  "stickyNotes.update": { name: "update_sticky_note", description: "Actualiza el título, contenido o color de una nota adhesiva en Kino" },
  "systems.create": { name: "create_system", description: "Crea un nuevo sistema (proyecto o área) en Kino" },
  "systems.list": { name: "list_systems", description: "Lista todos los sistemas del usuario en Kino (proyectos, áreas, etc.)" },
  "systems.remove": { name: "delete_system", description: "Desactiva (soft-delete) un sistema en Kino. No puede eliminarse el Inbox." },
  "systems.reorder": null,
  "systems.setup": null,
  "systems.update": { name: "update_system", description: "Actualiza propiedades de un sistema existente en Kino (nombre, color, ícono, propósito, etc.)" },
  "tags.bySystem": null,
  "tags.create": null,
  "tags.remove": null,
  "tags.update": null,
  "tasks.bulkCreate": { name: "bulk_create_tasks", description: "Crea múltiples tareas en Kino en una sola operación (máximo 50). Para crear SUBTAREAS de una tarea padre, define parentTaskId en cada item (todas pueden apuntar al mismo padre). Útil tras generate_subtasks.  " },
  "tasks.bulkMove": { name: "bulk_move_tasks", description: "Mueve múltiples tareas al mismo estado en una sola operación (máximo 50)" },
  "tasks.bulkUpdate": { name: "bulk_update_tasks", description: "Actualiza la prioridad de múltiples tareas en una sola operación (máximo 50)" },
  "tasks.byFolder": { name: "list_folder_tasks", description: "Lista las tareas asignadas directamente a una carpeta de un sistema" },
  "tasks.byId": { name: "get_task", description: "Obtiene el detalle completo de una tarea por su ID" },
  "tasks.bySystem": null,
  "tasks.calendar": null,
  "tasks.create": { name: "create_task", description: "Crea una tarea en Kino. REGLA DE STATUS: Si no se especifica startDate ni status, usa status=\"week\" para que la tarea aparezca en la Action View (vista principal). Solo usa status=\"backlog\" para ideas o trabajo sin fecha. Si tienes una fecha de inicio, pásala en startDate y el status se derivará automáticamente. RECORDATORIOS: Si la tarea tiene dueDate, Kino enviará notificaciones push automáticamente (día anterior y día del vencimiento), siempre que el usuario tenga push habilitado.  " },
  "tasks.createTimeLog": { name: "log_task_time", description: "Registra una sesión de tiempo trabajada en una tarea (time log). Las fechas van en ISO 8601 UTC." },
  "tasks.list": { name: "list_tasks", description: "Lista tareas del usuario en Kino con filtros opcionales" },
  "tasks.move": { name: "move_task", description: "Mueve una tarea a un estado diferente (backlog, week, tomorrow, today, done)" },
  "tasks.moveBoard": { name: "move_task_board", description: "Mueve una tarjeta a otra columna del board kanban (systemType \"project\"). Columnas por defecto: todo, in_progress, review, done. Mover a la columna terminal (done) completa la tarea automáticamente; sacarla de done la reabre.  " },
  "tasks.remove": {
    name: "delete_task",
    description: "Elimina una tarea de Kino (borrado lógico — la tarea queda en papelera, no se destruye)",
    confirmation: ({ id }) => `Tarea ${String(id)} eliminada correctamente.`,
  },
  "tasks.reorder": null,
  "tasks.restore": { name: "restore_task", description: "Restaura una tarea previamente eliminada (soft-delete) en Kino, devolviéndola a la papelera al estado activo." },
  "tasks.subtasks": { name: "get_subtasks", description: "Lista las subtareas de una tarea padre" },
  "tasks.timeLogSummary": null,
  "tasks.todayPlan": null,
  "tasks.toggle": { name: "complete_task", description: "Marca una tarea como completada (o la descompletada si ya estaba hecha)" },
  "tasks.update": { name: "update_task", description: "Actualiza campos de una tarea existente en Kino" },
  "writing.applyPlotOperation": null,
  "writing.chapterSummary": null,
  "writing.closeSession": null,
  "writing.journal": null,
  "writing.manuscript": null,
  "writing.overview": null,
  "writing.plot": null,
  "writing.reorderTimeline": null,
  "writing.resolveThread": null,
  "writing.restoreSnapshot": null,
  "writing.setCompleted": null,
  "writing.snapshot": null,
  "writing.snapshots": null,
  "writing.storySearch": { name: "search_story", description: "Busca una frase dentro del texto de las obras de un sistema y devuelve los capítulos con fragmentos alrededor de cada coincidencia" },
  "writing.structure": { name: "get_work_structure", description: "Estructura de una obra: sus capítulos en orden con palabras, si están terminados y qué entidades del codex aparecen en cada uno. La vista de conjunto para razonar sobre continuidad" },
  "writing.studio": null,
  "writing.threads": null,
  "writing.timeline": { name: "get_timeline", description: "Cronología in-world de una obra: los eventos del codex ordenados en el tiempo de la historia, con el capítulo donde se cuenta cada uno y cuáles se narran fuera de orden (flashbacks). Los eventos sin ubicar vienen aparte" },
  "writing.unplaceFromTimeline": null,
};
