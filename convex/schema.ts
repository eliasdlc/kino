// convex/schema.ts
//
// Las treinta y cinco tablas de Kino sobre Convex. Es la traducción campo a campo
// de `src/shared/db/schema.ts` (Postgres, 35 tablas), menos las nueve que no
// viajan, más las nueve que la fase 1 iba a crear por migración y que aquí nacen
// gratis. Un solo fichero a propósito: Convex exige uno, y el carril único del
// proyecto se gobierna mejor con un fichero que todo el mundo sabe que es de un
// agente a la vez.
//
// ── Qué no viaja y por qué ────────────────────────────────────────────────
// sessions, accounts, verifications, jwks, oauth_clients, oauth_refresh_tokens,
// oauth_access_tokens, oauth_consents: identidad y OAuth, ahora de Clerk.
// api_keys: el único MCP es el remoto con OAuth de Clerk; no hay claves propias.
// users pierde email_verified, provider y provider_id (Clerk) y gana clerkId.
// folders.path (ltree): el árbol se arma en memoria desde parentId.
// tasks.search_vector, pages.search_vector (tsvector): sustituidos por `lemas`,
// un texto lematizado al escribir con índice de búsqueda de Convex.
//
// ── Convenciones de tipo ──────────────────────────────────────────────────
// timestamptz  → number, milisegundos desde epoch (`ts`).
// date         → string 'YYYY-MM-DD' (`dayStr`): es un día del usuario, no un
//                instante, y como número perdería ese sentido.
// time         → string 'HH:MM' (`clockStr`).
// jsonb        → `json` (objeto) o el array tipado cuando la forma es conocida.
// enum         → unión de literales. Añadir un valor es expand; quitarlo,
//                contract con los documentos ya migrados.
// uuid FK      → v.id('tabla'). Convex no tiene cascadas: cada ON DELETE del
//                schema de Postgres es código en la mutación que borra, listado
//                en scripts/migrate-to-convex por el ticket del importador.
// texto JSON   → user_energy_profile.recharge_presets y learned_curve eran JSON
//                dentro de text; aquí son arrays de verdad.
//
// ── pgId ──────────────────────────────────────────────────────────────────
// Cada tabla que viene de Postgres lleva `pgId` opcional con índice: es la
// tabla de correspondencia del importador, guardada en el propio documento.
// Con ella el import es idempotente (segunda pasada = upsert por pgId) y la
// huella de verificación puede cruzar filas una a una. Las tablas de unión sin
// id propio (task_page_links, page_tags, page_entity_mentions, rate_limits) no
// la llevan: su identidad es el par.
//
// ── Unicidad y CHECK ──────────────────────────────────────────────────────
// Convex no tiene índices únicos ni CHECK. Cada uno del schema de Postgres
// queda como índice más comprobación en la mutación:
//   users.email, users.clerkId               → by_email, by_clerkId
//   one_inbox_per_user                        → by_user_inbox (userId, isInbox)
//   uq_system_status                          → by_type_status
//   idx_tasks_client_request, idx_pages_…,
//   idx_sticky_client_request                 → by_user_clientRequest
//   uq_tasks_external                         → by_user_external
//   uq_sprints_external                       → by_system_external
//   uq_sync_user_provider                     → by_user_provider
//   push_subscriptions.endpoint               → by_endpoint
//   uq_checkin_slot, uq_prediction_slot       → by_user_day_slot
//   uq_snapshot_user_date                     → by_user_day
//   rate_limits PK                            → by_identity_bucket
//   tasks_status_valid, tasks_board_status_non_empty, sticky_note_location,
//   duration_minutes_non_negative, time_log_single_target,
//   checkin_level_range, prediction_level_range → validador de la mutación
//                                                 (literal, o Zod del slice).
//
// ── Índices parciales ─────────────────────────────────────────────────────
// Postgres filtraba `WHERE deleted_at IS NULL` en el índice. Aquí `deletedAt`
// va como campo del índice, delante de lo que se filtra, y la query hace
// `.eq('deletedAt', undefined)`: Convex indexa la ausencia del campo.
//
// ── Índices de Postgres que no tienen equivalente, y por qué ──────────────
//   idx_users_provider           → provider ya no existe.
//   idx_sessions_*, idx_accounts_*, idx_verifications_identifier,
//   idx_oauth_*, idx_api_keys_user → sus tablas no viajan.
//   idx_folders_path (GiST)      → no hay path; el árbol se arma en memoria.
//   idx_tasks_recurring          → by_user_alive_recurrence lo cubre.
//   idx_task_reminders_pending   → by_sent_remindAt (sentAt, remindAt).
//   idx_cron_runs_job_started    → by_job_started.
//   los GIN de search_vector     → search_lemas en tasks, pages y stickyNotes.
//
// ── Lo que la fase 1 iba a añadir por migración y aquí nace opcional ──────
// createdBy/createdVia en tasks, pages, folders, stickyNotes, systems,
// entities; completedBy/completedVia en tasks y pages; deletedAt en folders y
// stickyNotes; systemId en stickyNotes y pageSnapshots;
// userEnergyProfile.ceilingMutedAt; users.lastActiveAt; tasks.digestId;
// systems.memberAgentsAllowed. Y las siete tablas nuevas: eventLog, itemLinks,
// systemMembers, systemInvites, sessionDigests, proposals, captures. Nacen sin
// lector ni escritor; la fase 1 decide su forma final y quién las rellena.

import { defineSchema, defineTable } from 'convex/server';
import { v, type VLiteral } from 'convex/values';

// ============================================================================
// Helpers de tipo
// ============================================================================

/** Unión de literales a partir de una lista: el enum de Postgres, en Convex. */
const literals = <const T extends readonly [string, ...string[]]>(values: T) =>
  v.union(
    ...(values.map((value) => v.literal(value)) as {
      -readonly [K in keyof T]: VLiteral<T[K]>;
    }),
  );

/** Instante en milisegundos desde epoch (era timestamptz). */
const ts = v.number();
/** Día del usuario, 'YYYY-MM-DD' (era date). */
const dayStr = v.string();
/** Hora del día, 'HH:MM' (era time). */
const clockStr = v.string();
/** Objeto JSON validado con Zod en el slice (era jsonb). */
const json = v.record(v.string(), v.any());
/** Id de la fila original en Postgres, para el importador. */
const pgId = v.optional(v.string());

// ============================================================================
// Enumeraciones
// ============================================================================

export const profileType = literals(['student', 'freelancer', 'corporate']);
export const templateType = literals([
  'academic',
  'project',
  'entrepreneurial',
  'personal',
  'custom',
  'inbox',
  'writing',
]);
export const energyLevel = literals(['high', 'medium', 'low']);
export const taskPriority = literals(['critical', 'high', 'medium', 'low']);
export const weekday = literals(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export const uiTheme = literals(['dark', 'light', 'system']);
export const timeSource = literals(['pomodoro', 'manual', 'timer', 'writing']);
export const taskType = literals([
  'task',
  'idea',
  'event',
  'reminder',
  'epic',
  // Valores heredados: siguen en documentos viejos, la UI no los ofrece.
  'habit',
  'todo',
  'project',
]);
export const accountStatus = literals(['active', 'banned']);
export const syncProvider = literals([
  'google_calendar',
  'jira',
  'slack',
  'microsoft_teams',
  'notion',
  'ical',
  'github',
]);
export const sprintStatus = literals(['active', 'completed']);
export const color = literals([
  'red',
  'blue',
  'pink',
  'purple',
  'green',
  'orange',
  'yellow',
  'teal',
  'gray',
  'black',
  'white',
]);
export const reminderSource = literals(['auto', 'user']);
export const chronotype = literals(['morning', 'intermediate', 'evening']);
export const sleepQuality = literals(['good', 'partial', 'poor']);
export const checkinSlot = literals(['morning', 'afternoon', 'evening']);
export const predictionAccuracy = literals(['accurate', 'partial', 'inaccurate']);
export const entityType = literals([
  'character',
  'location',
  'object',
  'concept',
  'event',
  'faction',
  'other',
]);
/** Eje de scheduling de una tarea. Cerrado: es la máquina de estados. */
export const taskStatus = literals(['backlog', 'week', 'tomorrow', 'today', 'done']);
/** Por qué puerta entró la escritura: sesión, cliente OAuth, sincronización o el sistema. */
export const actorChannel = literals(['session', 'oauth', 'sync', 'system']);
export const memberRole = literals(['owner', 'member']);
export const planTier = literals(['free', 'paid']);
/** Los siete tipos de objeto que un evento o una arista pueden señalar. */
export const itemType = literals([
  'task',
  'page',
  'folder',
  'stickyNote',
  'system',
  'entity',
  'sprint',
]);
export const proposalStatus = literals(['pending', 'applied', 'dismissed', 'expired']);
export const proposalKind = literals(['archive', 'cancel', 'rewrite']);
export const captureStatus = literals(['pending', 'confirmed', 'discarded', 'expired']);
export const captureKind = literals(['voice', 'photo', 'link', 'text']);

/** Campos de autoría que la fase 1 vuelve obligatorios. */
const authorship = {
  createdBy: v.optional(v.id('users')),
  createdVia: v.optional(actorChannel),
};

/** Firma del cierre: quién completó y por qué vía. Solo tasks y pages tienen cierre. */
const closing = {
  completedBy: v.optional(v.id('users')),
  completedVia: v.optional(actorChannel),
};

// ============================================================================
// Schema
// ============================================================================

export default defineSchema({
  // ── Cuenta ────────────────────────────────────────────────────────────────

  // Un documento por persona. Clerk es la identidad; aquí vive lo que Kino
  // sabe de ella. `clerkId` nace opcional porque el importador llega antes que
  // la migración de usuarios a Clerk; ese ticket lo vuelve obligatorio.
  users: defineTable({
    pgId,
    clerkId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    status: accountStatus,
    timezone: v.string(),
    // Última sesión, escrita como mucho una vez al día.
    lastActiveAt: v.optional(ts),
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_clerkId', ['clerkId'])
    .index('by_email', ['email']),

  // Aparte de `users` a propósito: cada función carga el usuario, y si los
  // ajustes vivieran dentro, cambiar el tema re-ejecutaría todas las queries.
  userSettings: defineTable({
    userId: v.id('users'),
    profileType: v.optional(profileType),
    // Identidad elegida en el onboarding. Texto libre: los segmentos cambian
    // más rápido que un enum.
    archetypeIdentity: v.optional(v.string()),
    onboardingVersion: v.number(),
    weeklyReviewDay: weekday,
    dailyResetTime: clockStr,
    // Día (en la zona del usuario) del último rollover del plan de hoy.
    todayPlanDate: v.optional(dayStr),
    dailyEnergyLimit: v.number(),
    focusTimeoutHours: v.number(),
    theme: uiTheme,
    notificationsEnabled: v.boolean(),
    createdAt: ts,
    updatedAt: ts,
  }).index('by_user', ['userId']),

  // 1:1 con la cuenta. El estado crudo del proveedor va en texto para no
  // migrar cada vez que invente uno.
  userBilling: defineTable({
    userId: v.id('users'),
    tier: planTier,
    providerStatus: v.optional(v.string()),
    providerCustomerId: v.optional(v.string()),
    createdAt: ts,
    updatedAt: ts,
  }).index('by_user', ['userId']),

  // Agregado mensual de lo que consume servidor. Los eventos caducan; el
  // contador no.
  usageCounters: defineTable({
    userId: v.id('users'),
    /** 'YYYY-MM'. */
    periodMonth: v.string(),
    metric: v.string(),
    amount: v.number(),
  }).index('by_user_period_metric', ['userId', 'periodMonth', 'metric']),

  // ── Trabajo ───────────────────────────────────────────────────────────────

  systems: defineTable({
    pgId,
    userId: v.id('users'),
    name: v.string(),
    color,
    identityStatement: v.optional(v.string()),
    templateType,
    energyIdeal: v.optional(energyLevel),
    icon: v.string(),
    isActive: v.boolean(),
    isInbox: v.boolean(),
    expectedFrequency: v.optional(v.string()),
    triggerContext: v.optional(v.string()),
    // SystemMetadata, discriminado por templateType y validado en el slice.
    metadata: v.optional(json),
    sortOrder: v.number(),
    // Si los agentes de un miembro pueden escribir en un sistema compartido.
    memberAgentsAllowed: v.optional(v.boolean()),
    ...authorship,
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_active', ['userId', 'isActive'])
    .index('by_user_sort', ['userId', 'sortOrder'])
    .index('by_user_inbox', ['userId', 'isInbox']),

  tasks: defineTable({
    pgId,
    userId: v.id('users'),
    systemId: v.id('systems'),
    parentTaskId: v.optional(v.id('tasks')),
    title: v.string(),
    description: v.optional(v.string()),
    status: taskStatus,
    // Segundo eje, solo en sistemas de tipo project: columna del tablero.
    // Dinámico por tipo de sistema (systemStatusDefinitions), nunca vacío.
    boardStatus: v.optional(v.string()),
    boardStatusChangedAt: v.optional(ts),
    energyLevel,
    priority: taskPriority,
    taskType: v.optional(taskType),
    // Instante con hora opcional. "Sin hora" es la medianoche local del usuario.
    dueDate: v.optional(ts),
    startDate: v.optional(ts),
    estimatedTime: v.optional(clockStr),
    recurrenceRule: v.optional(v.string()),
    recurrenceParentId: v.optional(v.id('tasks')),
    folderId: v.optional(v.id('folders')),
    contextTagId: v.optional(v.id('contextTags')),
    sprintId: v.optional(v.id('sprints')),
    externalSource: v.optional(v.string()),
    externalId: v.optional(v.string()),
    // Idempotencia de la captura offline: lo genera el cliente al pulsar crear.
    clientRequestId: v.optional(v.string()),
    sortIndex: v.number(),
    metadata: v.optional(json),
    inTodayPlan: v.boolean(),
    notifiedBeforeDay: v.boolean(),
    notifiedDueDay: v.boolean(),
    reminderCount: v.number(),
    lastRemindedAt: v.optional(ts),
    completedAt: v.optional(ts),
    deletedAt: v.optional(ts),
    // Texto lematizado de título y descripción, escrito por la mutación.
    lemas: v.optional(v.string()),
    // El digest del que nació la tarea, si nació de uno.
    digestId: v.optional(v.id('sessionDigests')),
    ...authorship,
    ...closing,
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_alive_status', ['userId', 'deletedAt', 'status'])
    .index('by_system_alive_status', ['systemId', 'deletedAt', 'status'])
    .index('by_user_alive_due', ['userId', 'deletedAt', 'dueDate'])
    .index('by_user_alive_recurrence', ['userId', 'deletedAt', 'recurrenceRule'])
    .index('by_user_clientRequest', ['userId', 'clientRequestId'])
    .index('by_parent', ['parentTaskId'])
    .index('by_recurrenceParent', ['recurrenceParentId'])
    .index('by_folder_alive', ['folderId', 'deletedAt'])
    .index('by_system_alive_board', ['systemId', 'deletedAt', 'boardStatus'])
    .index('by_sprint', ['sprintId'])
    .index('by_user_external', ['userId', 'externalSource', 'externalId'])
    .index('by_user_alive_completed', ['userId', 'deletedAt', 'completedAt'])
    .searchIndex('search_lemas', {
      searchField: 'lemas',
      filterFields: ['userId', 'systemId', 'deletedAt'],
    }),

  sprints: defineTable({
    pgId,
    userId: v.id('users'),
    systemId: v.id('systems'),
    name: v.string(),
    goal: v.optional(v.string()),
    startDate: v.optional(ts),
    endDate: v.optional(ts),
    status: sprintStatus,
    completedAt: v.optional(ts),
    sortOrder: v.number(),
    externalId: v.optional(v.string()),
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_system_status', ['systemId', 'status'])
    .index('by_user', ['userId'])
    .index('by_system_external', ['systemId', 'externalId']),

  contextTags: defineTable({
    pgId,
    userId: v.id('users'),
    // Sin systemId es una etiqueta global del usuario.
    systemId: v.optional(v.id('systems')),
    title: v.string(),
    color,
    isDefault: v.boolean(),
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user', ['userId'])
    .index('by_system', ['systemId']),

  // Columnas válidas del tablero por tipo de sistema. Sembradas desde el
  // manifiesto de arquetipos.
  systemStatusDefinitions: defineTable({
    pgId,
    systemType: templateType,
    statusName: v.string(),
    label: v.string(),
    position: v.number(),
    emoji: v.optional(v.string()),
  })
    .index('by_pgId', ['pgId'])
    .index('by_type_status', ['systemType', 'statusName']),

  taskReminders: defineTable({
    pgId,
    taskId: v.id('tasks'),
    userId: v.id('users'),
    remindAt: ts,
    sentAt: v.optional(ts),
    label: v.optional(v.string()),
    source: reminderSource,
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_sent_remindAt', ['sentAt', 'remindAt'])
    .index('by_task', ['taskId'])
    .index('by_user', ['userId']),

  // ── Contenido ─────────────────────────────────────────────────────────────

  folders: defineTable({
    pgId,
    userId: v.id('users'),
    systemId: v.optional(v.id('systems')),
    parentId: v.optional(v.id('folders')),
    name: v.string(),
    color,
    sortIndex: v.number(),
    // Campos propios del rol de carpeta por arquetipo, validados en el slice.
    metadata: v.optional(json),
    deletedAt: v.optional(ts),
    ...authorship,
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_alive', ['userId', 'deletedAt'])
    .index('by_parent', ['parentId'])
    .index('by_system', ['systemId']),

  pages: defineTable({
    pgId,
    userId: v.id('users'),
    folderId: v.optional(v.id('folders')),
    systemId: v.optional(v.id('systems')),
    parentPageId: v.optional(v.id('pages')),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    isPinned: v.boolean(),
    // Capítulo terminado. Ausente = en curso.
    completedAt: v.optional(ts),
    deletedAt: v.optional(ts),
    clientRequestId: v.optional(v.string()),
    lemas: v.optional(v.string()),
    ...authorship,
    ...closing,
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_clientRequest', ['userId', 'clientRequestId'])
    .index('by_user_alive', ['userId', 'deletedAt'])
    .index('by_folder', ['folderId'])
    .index('by_system', ['systemId'])
    .index('by_parent', ['parentPageId'])
    .searchIndex('search_lemas', {
      searchField: 'lemas',
      filterFields: ['userId', 'systemId', 'deletedAt'],
    }),

  // Vive en una página o en una carpeta, nunca en las dos ni en ninguna.
  stickyNotes: defineTable({
    pgId,
    userId: v.id('users'),
    pageId: v.optional(v.id('pages')),
    folderId: v.optional(v.id('folders')),
    systemId: v.optional(v.id('systems')),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    color,
    sortIndex: v.number(),
    // 'left' | 'right' | 'over'; ausente = en la rejilla.
    positionSide: v.optional(v.string()),
    // Fracciones [0,1] del alto del contenido y del ancho del margen.
    positionY: v.optional(v.number()),
    positionX: v.optional(v.number()),
    // Id de la marca de anclaje en ProseMirror; ausente = nota libre.
    anchorId: v.optional(v.string()),
    // Las notas con el mismo stackId forman una pila visual.
    stackId: v.optional(v.string()),
    isEureka: v.boolean(),
    textAnchor: v.optional(v.string()),
    clientRequestId: v.optional(v.string()),
    deletedAt: v.optional(ts),
    lemas: v.optional(v.string()),
    ...authorship,
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_clientRequest', ['userId', 'clientRequestId'])
    .index('by_user_alive', ['userId', 'deletedAt'])
    .index('by_page', ['pageId'])
    .index('by_folder', ['folderId'])
    .searchIndex('search_lemas', {
      searchField: 'lemas',
      filterFields: ['userId', 'systemId', 'deletedAt'],
    }),

  // Una foto del texto por sesión de escritura. El servicio no guarda si el
  // texto no cambió y poda dejando los últimos N por página.
  pageSnapshots: defineTable({
    pgId,
    pageId: v.id('pages'),
    userId: v.id('users'),
    systemId: v.optional(v.id('systems')),
    content: v.optional(v.string()),
    wordCount: v.number(),
    sessionStartedAt: v.optional(ts),
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_page_created', ['pageId', 'createdAt'])
    .index('by_user', ['userId']),

  // El universo de la historia, compartido a nivel de sistema.
  entities: defineTable({
    pgId,
    userId: v.id('users'),
    systemId: v.id('systems'),
    type: entityType,
    name: v.string(),
    aliases: v.array(v.string()),
    summary: v.optional(v.string()),
    // Discriminado por `type`, validado con Zod en el slice.
    attributes: v.optional(json),
    coverImageUrl: v.optional(v.string()),
    images: v.array(v.string()),
    // Menciones que tenía cuando el autor dio el hilo por cerrado. Ausente =
    // nunca se cerró.
    threadResolvedMentions: v.optional(v.number()),
    deletedAt: v.optional(ts),
    ...authorship,
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_system_alive', ['systemId', 'deletedAt'])
    .index('by_user', ['userId']),

  entityRelations: defineTable({
    pgId,
    fromEntityId: v.id('entities'),
    toEntityId: v.id('entities'),
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_from', ['fromEntityId'])
    .index('by_to', ['toEntityId']),

  taskPageLinks: defineTable({
    taskId: v.id('tasks'),
    pageId: v.id('pages'),
  })
    .index('by_task_page', ['taskId', 'pageId'])
    .index('by_page', ['pageId']),

  pageTags: defineTable({
    pageId: v.id('pages'),
    tagId: v.id('contextTags'),
  })
    .index('by_page_tag', ['pageId', 'tagId'])
    .index('by_tag', ['tagId']),

  // Derivada: se recalcula al guardar la página contra nombres y alias.
  pageEntityMentions: defineTable({
    pageId: v.id('pages'),
    entityId: v.id('entities'),
    mentionCount: v.number(),
  })
    .index('by_page_entity', ['pageId', 'entityId'])
    .index('by_entity', ['entityId']),

  // ── Energía y medida ──────────────────────────────────────────────────────

  userEnergyProfile: defineTable({
    userId: v.id('users'),
    chronotype,
    sleepTypicalHours: v.number(),
    availableHoursPerDay: v.number(),
    energyFloor: v.number(),
    rechargePresets: v.array(json),
    // 24 valores horarios, o vacío si todavía no aprendió.
    learnedCurve: v.array(v.number()),
    learningAlpha: v.number(),
    // Interruptor de honestidad: ausente = techo encendido.
    ceilingMutedAt: v.optional(ts),
    createdAt: ts,
    updatedAt: ts,
  }).index('by_user', ['userId']),

  energyCheckins: defineTable({
    pgId,
    userId: v.id('users'),
    date: dayStr,
    slot: checkinSlot,
    currentLevel: v.number(),
    sleepQuality,
    predictionAccuracy: v.optional(predictionAccuracy),
    alphaBefore: v.optional(v.number()),
    alphaAfter: v.optional(v.number()),
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_day_slot', ['userId', 'date', 'slot']),

  // Escrita antes de conocer el resultado, para que la verificación no sea
  // circular.
  energyPredictions: defineTable({
    pgId,
    userId: v.id('users'),
    date: dayStr,
    slot: checkinSlot,
    predictedLevel: v.number(),
    alphaAtPrediction: v.number(),
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_day_slot', ['userId', 'date', 'slot']),

  behaviorSnapshots: defineTable({
    pgId,
    userId: v.id('users'),
    date: dayStr,
    tasksCreated: v.number(),
    tasksCompleted: v.number(),
    tasksOverdue: v.number(),
    criticalCount: v.number(),
    activeCount: v.number(),
    completionRate: v.number(),
    learningAlpha: v.number(),
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_day', ['userId', 'date']),

  // Apunta a exactamente un objetivo: una tarea o una página.
  timeLogs: defineTable({
    pgId,
    userId: v.id('users'),
    taskId: v.optional(v.id('tasks')),
    pageId: v.optional(v.id('pages')),
    systemId: v.id('systems'),
    startedAt: ts,
    endedAt: v.optional(ts),
    durationMinutes: v.number(),
    wordsWritten: v.optional(v.number()),
    source: timeSource,
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_started', ['userId', 'startedAt'])
    .index('by_system_started', ['systemId', 'startedAt'])
    .index('by_user_page_started', ['userId', 'pageId', 'startedAt'])
    .index('by_task', ['taskId']),

  // ── Integraciones y operación ─────────────────────────────────────────────

  syncConnections: defineTable({
    pgId,
    userId: v.id('users'),
    provider: syncProvider,
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    lastSyncedAt: v.optional(ts),
    createdAt: ts,
    updatedAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_user_provider', ['userId', 'provider']),

  pushSubscriptions: defineTable({
    pgId,
    userId: v.id('users'),
    endpoint: v.string(),
    authKey: v.string(),
    p256dhKey: v.string(),
    createdAt: ts,
  })
    .index('by_pgId', ['pgId'])
    .index('by_endpoint', ['endpoint'])
    .index('by_user', ['userId']),

  // Bitácora de las tareas programadas. No lleva userId: es del sistema.
  cronRuns: defineTable({
    pgId,
    job: v.string(),
    startedAt: ts,
    // Ausente mientras corre: una fila sin cerrar es una ejecución caída.
    finishedAt: v.optional(ts),
    ok: v.boolean(),
    error: v.optional(v.string()),
    result: v.optional(v.any()),
  })
    .index('by_pgId', ['pgId'])
    .index('by_job_started', ['job', 'startedAt']),

  // Contador del rate limit por identidad y clase de tráfico.
  rateLimits: defineTable({
    identity: v.string(),
    bucket: v.string(),
    windowStart: ts,
    hits: v.number(),
  })
    .index('by_identity_bucket', ['identity', 'bucket'])
    .index('by_window', ['windowStart']),

  // ── Auditoría y colaboración ──────────────────────────────────────────────

  // Registra escrituras que el usuario pidió. Sostiene el log, el deshacer,
  // las aristas automáticas y el consumo de servidor. Poda a 30 días.
  eventLog: defineTable({
    userId: v.id('users'),
    systemId: v.optional(v.id('systems')),
    actorId: v.optional(v.id('users')),
    actorChannel,
    // Cliente OAuth que actuó, cuando el canal es oauth.
    clientId: v.optional(v.string()),
    action: v.string(),
    targetType: itemType,
    // Sin referencia tipada a propósito: el lector tolera un objetivo borrado.
    targetId: v.string(),
    // Diff acotado a 2.048 bytes en la mutación.
    payload: json,
    occurredAt: ts,
    undoneAt: v.optional(ts),
    undoneFields: v.optional(v.array(v.string())),
    proposalId: v.optional(v.id('proposals')),
    snapshotId: v.optional(v.id('pageSnapshots')),
  })
    .index('by_user_occurred', ['userId', 'occurredAt'])
    .index('by_system_occurred', ['systemId', 'occurredAt'])
    .index('by_target', ['targetType', 'targetId'])
    .index('by_occurred', ['occurredAt']),

  // Las aristas de "toca esto". Par canónico, una fila por arista; el peso
  // decaído se calcula al leer. Poda a 30 días por lastSeenAt.
  itemLinks: defineTable({
    userId: v.id('users'),
    fromType: itemType,
    fromId: v.string(),
    fromSystemId: v.id('systems'),
    toType: itemType,
    toId: v.string(),
    toSystemId: v.id('systems'),
    reason: v.string(),
    hits: v.number(),
    lastSeenAt: ts,
  })
    .index('by_from', ['fromType', 'fromId'])
    .index('by_to', ['toType', 'toId'])
    .index('by_user', ['userId'])
    .index('by_lastSeen', ['lastSeenAt']),

  // Quién alcanza qué sistema. Es la consulta de cada petición.
  systemMembers: defineTable({
    systemId: v.id('systems'),
    userId: v.id('users'),
    role: memberRole,
    invitedBy: v.optional(v.id('users')),
    createdAt: ts,
  })
    .index('by_system_user', ['systemId', 'userId'])
    .index('by_user', ['userId']),

  systemInvites: defineTable({
    systemId: v.id('systems'),
    /** Correo en minúsculas. */
    email: v.string(),
    /** SHA-256 hex del token enviado. */
    tokenHash: v.string(),
    role: memberRole,
    invitedBy: v.optional(v.id('users')),
    expiresAt: ts,
    acceptedAt: v.optional(ts),
    revokedAt: v.optional(ts),
    createdAt: ts,
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_system_email', ['systemId', 'email']),

  // El digest de una sesión de trabajo. surfacedAt y actedAt son el criterio
  // de muerte del diario. No se poda.
  sessionDigests: defineTable({
    userId: v.id('users'),
    source: v.string(),
    externalId: v.string(),
    // Acotado a 8.192 bytes en la mutación.
    digest: json,
    surfacedAt: v.optional(ts),
    actedAt: v.optional(ts),
    createdAt: ts,
  })
    .index('by_user_source_external', ['userId', 'source', 'externalId'])
    .index('by_user_created', ['userId', 'createdAt']),

  // Una propuesta es una fila con estado que caduca. Techo de veinte
  // pendientes por usuario, aplicado en la mutación.
  proposals: defineTable({
    userId: v.id('users'),
    systemId: v.optional(v.id('systems')),
    status: proposalStatus,
    kind: proposalKind,
    // Cliente OAuth que la propuso; permite descartar todas las de un origen.
    sourceClientId: v.optional(v.string()),
    // La fila que le sirve de evidencia; el servidor la resuelve y la pinta.
    evidenceType: itemType,
    evidenceId: v.string(),
    payload: json,
    expiresAt: ts,
    resolvedAt: v.optional(ts),
    createdAt: ts,
  })
    .index('by_user_status', ['userId', 'status'])
    .index('by_expires', ['expiresAt']),

  // Lo compartido desde fuera, entre que llega y que se confirma. Caduca con
  // aviso, nunca en silencio.
  captures: defineTable({
    userId: v.id('users'),
    status: captureStatus,
    kind: captureKind,
    blobPath: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    text: v.optional(v.string()),
    url: v.optional(v.string()),
    // Items tipados con destino propuesto que el agente devolvió.
    proposedItems: v.optional(v.array(json)),
    expiresAt: ts,
    resolvedAt: v.optional(ts),
    createdAt: ts,
  })
    .index('by_user_status', ['userId', 'status'])
    .index('by_expires', ['expiresAt']),
});
