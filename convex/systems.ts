import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { githubRepoRefSchema } from '../src/features/github-sync/github-sync.schemas';
import {
  buildSystemFacts,
  describeSystem,
  isUnstarted,
  type BrainSignals,
  type FactRow,
} from '../src/features/systems/brain';
import { deriveStale } from '../src/features/systems/systems.signals';
import { resolveManifest } from '../src/shared/lib/system-manifest';
import type { SystemMetadata } from '../src/shared/lib/system-types';
import { TEMPLATE_TYPE_VALUES } from '../src/shared/types/enums';
import { forbidden, notFound } from './lib/errors';
import { diferencias, recordEvent } from './eventLog';
import { kinoZodMutation, kinoZodQuery, type Channel } from './lib/fn';
import { calendarDayInTz, userToday } from './lib/time';
import { color } from './schema';

// Los sistemas: el segundo hub del schema. Borrar es desactivar, así que las
// tareas y carpetas que cuelgan de uno no se tocan.

const COLORS = color.members.map((m) => m.value) as [string, ...string[]];
const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());

/** El sistema tal como lo ve el cliente. */
export function systemItem(doc: Doc<'systems'>) {
  return {
    id: doc._id,
    userId: doc.userId,
    name: doc.name,
    color: doc.color,
    identityStatement: doc.identityStatement ?? null,
    templateType: doc.templateType,
    energyIdeal: doc.energyIdeal ?? null,
    icon: doc.icon,
    isActive: doc.isActive,
    isInbox: doc.isInbox,
    expectedFrequency: doc.expectedFrequency ?? null,
    triggerContext: doc.triggerContext ?? null,
    metadata: doc.metadata ?? null,
    sortOrder: doc.sortOrder,
    createdAt: iso(doc.createdAt)!,
    updatedAt: iso(doc.updatedAt)!,
  };
}
export type SystemItem = ReturnType<typeof systemItem>;

async function ownSystem(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'systems'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) notFound('System not found');
  return doc;
}

const systemFields = {
  name: z.string().min(1).max(255),
  identityStatement: z.string().max(500).optional(),
  templateType: z.enum(TEMPLATE_TYPE_VALUES).optional(),
  energyIdeal: z.enum(['high', 'medium', 'low']).optional(),
  color: z.enum(COLORS),
  icon: z.string().max(50).default('folder'),
  expectedFrequency: z.string().max(20).optional(),
  triggerContext: z.string().max(255).optional(),
};

const tabId = z.enum(['backlog', 'planning', 'action', 'archive']);
const noun = z.string().trim().min(1).max(24);
export const systemMetadataSchema = z.object({
  tabs: z.array(tabId).optional(),
  defaultTab: tabId.optional(),
  composition: z
    .object({
      containers: z.object({ enabled: z.boolean(), noun, nounPlural: noun }).optional(),
      pages: z.object({ noun, nounPlural: noun, primary: z.boolean() }).optional(),
      taskKinds: z
        .array(z.object({ id: z.string().min(1).max(40), label: z.string().trim().min(1).max(32) }))
        .max(8)
        .optional(),
    })
    .optional(),
  /**
   * La cadencia de ciclos de un sistema académico: en qué meses empieza cada
   * uno, y el primero abre el año académico. De aquí sale la lista de ciclos
   * que se elige en vez de escribirlos a mano. Sin ella, la de PUCMM.
   */
  academic: z
    .object({ cycleStartMonths: z.array(z.coerce.number().int().min(1).max(12)).min(1).max(6) })
    .optional(),
  dailyWordGoal: z.coerce.number().int().min(0).max(100_000).optional(),
  chekhov: z
    .object({
      maxMentions: z.coerce.number().int().min(1).max(50),
      minSilentChapters: z.coerce.number().int().min(1).max(50),
    })
    .optional(),
  github: githubRepoRefSchema.optional(),
});

// ── Lecturas ────────────────────────────────────────────────────────────────

/**
 * Los sistemas activos con sus señales: cuántas tareas vivas tienen y cuánto
 * hace que no registran actividad, que es lo que decide si están parados.
 */
async function systemWithSignals(ctx: QueryCtx, system: Doc<'systems'>) {
  const now = Date.now();
  const days = (from: number) => Math.floor((now - from) / 86_400_000);
  const [tasks, logs] = await Promise.all([
    ctx.db.query('tasks').withIndex('by_system_alive_status', (q) => q.eq('systemId', system._id).eq('deletedAt', undefined)).collect(),
    ctx.db.query('timeLogs').withIndex('by_system_started', (q) => q.eq('systemId', system._id)).collect(),
  ]);
  const activeTaskCount = tasks.filter((task) => task.status !== 'done').length;
  const lastActivity = Math.max(0, ...tasks.map((task) => task.completedAt ?? 0), ...logs.map((log) => log.createdAt));
  const daysSinceLastActivity = lastActivity > 0 ? days(lastActivity) : null;
  const stale = !system.isInbox && deriveStale({
    expectedFrequency: system.expectedFrequency, activeTaskCount, daysSinceLastActivity,
    daysSinceCreated: days(system.createdAt),
  });
  // La próxima entrega sale de las tareas que esta función ya recogió: la
  // cabecera la enseña sin que la ruta tenga que pedir la lista entera.
  const nextDueDate = tasks
    .filter((task) => task.status !== 'done' && task.dueDate !== undefined)
    .map((task) => task.dueDate!)
    .sort((a, b) => a - b)[0];
  return {
    ...systemItem(system),
    stale,
    daysSinceLastActivity,
    activeTaskCount,
    nextDueDate: nextDueDate !== undefined ? new Date(nextDueDate).toISOString() : null,
  };
}

/** El detalle sólo calcula señales del sistema que se está abriendo. */
export const detail = kinoZodQuery({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const system = await ownSystem(ctx, ctx.user._id, id);
    if (!system.isActive) notFound('System not found');
    return systemWithSignals(ctx, system);
  },
});

export const list = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const docs = await ctx.db
      .query('systems')
      .withIndex('by_user_active', (q) => q.eq('userId', userId).eq('isActive', true))
      .collect();
    return Promise.all(docs.sort((a, b) => a.sortOrder - b.sortOrder).map((system) => systemWithSignals(ctx, system)));
  },
});

/**
 * La Bandeja de esta persona, resuelta en el servidor.
 *
 * Existe porque `/bandeja` es una entrada de navegación y no puede depender de
 * que el cliente cargue la lista de sistemas para saber a dónde va: hasta ahora
 * el id salía de un `systems.find((s) => s.isInbox)` repetido en cuatro sitios,
 * y meterlo en la barra inferior habría sido el quinto. Devuelve `null` cuando
 * la cuenta todavía no tiene Bandeja, que es lo que pasa entre el registro y
 * `systems.setup`.
 */
export const inbox = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query('systems')
      .withIndex('by_user_inbox', (q) => q.eq('userId', ctx.user._id).eq('isInbox', true))
      .first();
    return doc && doc.isActive ? systemItem(doc) : null;
  },
});

export const byId = kinoZodQuery({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const doc = await ownSystem(ctx, ctx.user._id, id);
    if (!doc.isActive) notFound('System not found');
    return systemItem(doc);
  },
});

// ── El mini cerebro ─────────────────────────────────────────────────────────

/** Días de sesiones que mira el tiempo observado. */
const OBSERVED_DAYS = 30;
/** Días abierta y sin un solo cambio para que una tarea parada sea un hecho. */
const STALLED_DAYS = 10;
/** Tareas en el mismo sitio para que eso sea una acumulación y no una lista. */
const PILEUP_MIN = 3;
/** Filas del log que se miran hacia atrás buscando una cuyo objetivo siga vivo. */
const MOVES_LOOKED = 15;
/**
 * Los cuatro estados del funnel. No son columnas de tablero ni vocabulario de
 * arquetipo, así que no salen del manifiesto: los mismos cuatro para todos.
 */
const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  week: 'Esta semana',
  tomorrow: 'Mañana',
  today: 'Hoy',
};

/** El día de un instante, escrito en la zona del usuario. Con año sólo si no es este. */
function formatDay(at: number, tz: string, now: number): string {
  const esteAnio = calendarDayInTz(at, tz).slice(0, 4) === calendarDayInTz(now, tz).slice(0, 4);
  return new Intl.DateTimeFormat('es', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    ...(esteAnio ? {} : { year: 'numeric' }),
  }).format(at);
}

/** Días de calendario entre dos días `yyyy-MM-dd` de la misma zona. */
function daysBetweenDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** La etiqueta de una columna del tablero. Una fila, buscada por su índice. */
async function columnLabel(ctx: QueryCtx, systemType: Doc<'systems'>['templateType'], statusName: string) {
  const definicion = await ctx.db
    .query('systemStatusDefinitions')
    .withIndex('by_type_status', (q) => q.eq('systemType', systemType).eq('statusName', statusName))
    .first();
  return definicion?.label ?? statusName;
}

/**
 * Lo que el mini cerebro mide de un sistema.
 *
 * **Qué rango lee** (restricción 9). Cinco lecturas, todas acotadas al sistema
 * que está abierto, y ninguna sobre una tabla entera:
 *
 * - `tasks.by_system_alive_status`: las tareas vivas de este sistema, cerradas
 *   incluidas, porque el párrafo cuenta las dos y casi todos los hechos salen
 *   de compararlas. Es la misma lectura que ya hace `systemWithSignals`.
 * - `timeLogs.by_system_started`: sólo los últimos treinta días. Sin ese `gte`
 *   la lectura crecería con la vida entera del sistema para responder la cifra
 *   de un mes.
 * - `folders.by_system` y `pages.by_system`: lo que cuelga del sistema, que es
 *   lo que el párrafo nombra con el vocabulario del arquetipo.
 * - `eventLog.by_system_occurred`: las quince últimas filas y ni una más.
 *
 * La fila que respalda un hecho sale siempre de esas cinco lecturas, nunca de
 * un `get` suelto: una fila borrada no está ahí, así que el hecho que la citaba
 * desaparece solo en vez de enseñar un enlace roto.
 */
async function brainSignals(ctx: QueryCtx, system: Doc<'systems'>, tz: string): Promise<BrainSignals> {
  const now = Date.now();
  const hoy = userToday(tz, now);
  const days = (from: number) => Math.max(0, Math.floor((now - from) / 86_400_000));
  const day = (at: number) => formatDay(at, tz, now);
  const manifest = resolveManifest(system.templateType, (system.metadata ?? null) as SystemMetadata | null);

  const [tasks, logs, folders, pages, moves] = await Promise.all([
    ctx.db
      .query('tasks')
      .withIndex('by_system_alive_status', (q) => q.eq('systemId', system._id).eq('deletedAt', undefined))
      .collect(),
    ctx.db
      .query('timeLogs')
      .withIndex('by_system_started', (q) =>
        q.eq('systemId', system._id).gte('startedAt', now - OBSERVED_DAYS * 86_400_000),
      )
      .collect(),
    ctx.db.query('folders').withIndex('by_system', (q) => q.eq('systemId', system._id)).collect(),
    ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', system._id)).collect(),
    ctx.db
      .query('eventLog')
      .withIndex('by_system_occurred', (q) => q.eq('systemId', system._id))
      .order('desc')
      .take(MOVES_LOOKED),
  ]);

  const carpetas = folders.filter((folder) => folder.deletedAt === undefined);
  const paginas = pages.filter((page) => page.deletedAt === undefined);

  const taskRow = (task: Doc<'tasks'>, at: number): FactRow => ({
    target: { kind: 'task', id: task._id },
    title: task.title,
    at: new Date(at).toISOString(),
    day: day(at),
  });
  const pageRow = (page: Doc<'pages'>, at: number): FactRow => ({
    target: { kind: 'page', id: page._id },
    title: page.title?.trim() || 'Sin título',
    at: new Date(at).toISOString(),
    day: day(at),
  });
  const folderRow = (folder: Doc<'folders'>, at: number): FactRow => ({
    target: { kind: 'folder', id: folder._id },
    title: folder.name,
    at: new Date(at).toISOString(),
    day: day(at),
  });

  const porId = {
    task: new Map(tasks.map((task) => [task._id as string, task])),
    page: new Map(paginas.map((page) => [page._id as string, page])),
    folder: new Map(carpetas.map((folder) => [folder._id as string, folder])),
  };

  /** La fila que señala un objetivo del log, o `null` si ya no existe. */
  const targetRow = (targetType: string, targetId: string, at: number): FactRow | null => {
    if (targetType === 'task') {
      const task = porId.task.get(targetId);
      return task ? taskRow(task, at) : null;
    }
    if (targetType === 'page') {
      const page = porId.page.get(targetId);
      return page ? pageRow(page, at) : null;
    }
    if (targetType === 'folder') {
      const folder = porId.folder.get(targetId);
      return folder ? folderRow(folder, at) : null;
    }
    return null;
  };

  const open = tasks.filter((task) => task.status !== 'done');
  const closed = tasks.filter((task) => task.status === 'done');

  // Lo que tiene fecha, ordenado. El corte entre vencido y próximo es el día
  // del calendario en la zona del usuario, nunca la resta de dos instantes.
  const conFecha = open
    .filter((task): task is Doc<'tasks'> & { dueDate: number } => task.dueDate !== undefined)
    .sort((a, b) => a.dueDate - b.dueDate);
  const vencidas = conFecha.filter((task) => calendarDayInTz(task.dueDate, tz) < hoy);
  const proxima = conFecha.find((task) => calendarDayInTz(task.dueDate, tz) >= hoy);

  // Dónde se acumula: un tablero agrupa por columna y el resto por estado del
  // funnel. El desempate alfabético evita que dos grupos iguales bailen.
  const porColumna = system.templateType === 'project' && open.some((task) => task.boardStatus !== undefined);
  const entro = (task: Doc<'tasks'>) => (porColumna ? task.boardStatusChangedAt ?? task.createdAt : task.createdAt);
  const grupos = new Map<string, Doc<'tasks'>[]>();
  for (const task of open) {
    const clave = porColumna ? task.boardStatus : task.status;
    if (!clave) continue;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(task);
    else grupos.set(clave, [task]);
  }
  const mayor = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  const acumulan = mayor && mayor[1].length >= PILEUP_MIN ? mayor : null;
  const masVieja = acumulan ? [...acumulan[1]].sort((a, b) => entro(a) - entro(b))[0] : null;

  // La tarea abierta que más tiempo lleva igual. Si es la misma que encabeza la
  // acumulación, no se repite: son dos hechos sobre una sola fila.
  const quieta = [...open].sort((a, b) => a.updatedAt - b.updatedAt)[0];
  const parada = quieta && quieta._id !== masVieja?._id && days(quieta.updatedAt) >= STALLED_DAYS ? quieta : null;

  const cerrada = closed
    .filter((task): task is Doc<'tasks'> & { completedAt: number } => task.completedAt !== undefined)
    .sort((a, b) => b.completedAt - a.completedAt)[0];

  // Contenedores que nadie llenó. Uno con carpetas dentro no está vacío: lo que
  // contiene son contenedores, no tareas.
  const conTareas = new Set(tasks.map((task) => task.folderId).filter(Boolean) as string[]);
  const conHijos = new Set(carpetas.map((folder) => folder.parentId).filter(Boolean) as string[]);
  const vacias = carpetas
    .filter((folder) => !conTareas.has(folder._id) && !conHijos.has(folder._id))
    .sort((a, b) => a.createdAt - b.createdAt);

  const minutos = logs.reduce((suma, log) => suma + log.durationMinutes, 0);
  const ultimaSesion = [...logs]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((log) => targetRow(log.taskId ? 'task' : 'page', (log.taskId ?? log.pageId ?? '') as string, log.startedAt))
    .find((row): row is FactRow => row !== null);

  const movimiento = moves
    .map((move) => ({ row: targetRow(move.targetType, move.targetId, move.occurredAt), at: move.occurredAt }))
    .find((candidato): candidato is { row: FactRow; at: number } => candidato.row !== null);

  return {
    today: formatDay(now, tz, now),
    container: manifest.folderRole
      ? {
          one: manifest.folderRole.noun,
          many: manifest.folderRole.nounPlural,
          gender: manifest.folderRole.gender,
        }
      : null,
    containerCount: carpetas.length,
    page: { one: manifest.pageRole.noun, many: manifest.pageRole.nounPlural, gender: manifest.pageRole.gender },
    pageCount: paginas.length,
    openCount: open.length,
    closedCount: closed.length,
    daysSinceCreated: days(system.createdAt),
    overdue: vencidas.length > 0 ? { count: vencidas.length, oldest: taskRow(vencidas[0], vencidas[0].dueDate) } : null,
    pileup:
      acumulan && masVieja
        ? {
            column: porColumna
              ? await columnLabel(ctx, system.templateType, acumulan[0])
              : STATUS_LABEL[acumulan[0]] ?? acumulan[0],
            count: acumulan[1].length,
            oldest: taskRow(masVieja, entro(masVieja)),
            days: days(entro(masVieja)),
          }
        : null,
    stalled: parada ? { row: taskRow(parada, parada.updatedAt), days: days(parada.updatedAt) } : null,
    nextDue: proxima
      ? { row: taskRow(proxima, proxima.dueDate), inDays: daysBetweenDays(hoy, calendarDayInTz(proxima.dueDate, tz)) }
      : null,
    emptyContainers: vacias.length > 0 ? { count: vacias.length, first: folderRow(vacias[0], vacias[0].createdAt) } : null,
    lastMove: movimiento ? { row: movimiento.row, days: days(movimiento.at) } : null,
    lastClosed: cerrada ? { row: taskRow(cerrada, cerrada.completedAt), days: days(cerrada.completedAt) } : null,
    observed: ultimaSesion ? { minutes: minutos, sessions: logs.length, last: ultimaSesion } : null,
  };
}

/**
 * El párrafo de estado del sistema y los hechos que lo respaldan, cada uno con
 * la fila que se puede abrir para comprobarlo.
 *
 * Es una lectura aparte de `detail` a propósito, y no un campo más suyo: el
 * bloque nace colapsado y no se suscribe hasta que alguien lo abre, así que las
 * cinco lecturas de `brainSignals` no se pagan en cada sistema que se abre.
 */
export const brain = kinoZodQuery({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const system = await ownSystem(ctx, ctx.user._id, id);
    if (!system.isActive) notFound('System not found');
    const signals = await brainSignals(ctx, system, ctx.user.timezone);
    return {
      paragraph: describeSystem(signals),
      facts: buildSystemFacts(signals),
      unstarted: isUnstarted(signals),
    };
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

/** La bandeja de entrada, una por persona. Crearla dos veces no hace nada. */
export const setup = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const inbox = await ctx.db
      .query('systems')
      .withIndex('by_user_inbox', (q) => q.eq('userId', ctx.user._id).eq('isInbox', true))
      .first();
    if (inbox) return { ok: true as const };
    const now = Date.now();
    await ctx.db.insert('systems', {
      userId: ctx.user._id,
      name: 'Inbox',
      color: 'blue',
      templateType: 'inbox',
      icon: 'inbox',
      isActive: true,
      isInbox: true,
      sortOrder: 0,
      createdBy: ctx.user._id,
      createdVia: 'system',
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true as const };
  },
});

export const create = kinoZodMutation({
  args: systemFields,
  handler: async (ctx, input) => createSystemDoc(ctx, ctx.user._id, ctx.channel, input),
});

/** Crea el sistema con sus etiquetas de proyecto. Exportada para el onboarding. */
export async function createSystemDoc(
  ctx: MutationCtx,
  userId: Id<'users'>,
  channel: Channel,
  input: z.infer<z.ZodObject<typeof systemFields>>,
) {
  {
    const existing = await ctx.db
      .query('systems')
      .withIndex('by_user_sort', (q) => q.eq('userId', userId))
      .collect();
    const now = Date.now();
    const id = await ctx.db.insert('systems', {
      userId,
      name: input.name,
      color: input.color as Doc<'systems'>['color'],
      identityStatement: input.identityStatement,
      templateType: input.templateType ?? 'custom',
      energyIdeal: input.energyIdeal ?? 'medium',
      icon: input.icon,
      isActive: true,
      isInbox: false,
      expectedFrequency: input.expectedFrequency ?? 'daily',
      triggerContext: input.triggerContext ?? '',
      // Los agentes de un miembro invitado no escriben aquí hasta que el dueño
      // lo permita a mano.
      memberAgentsAllowed: false,
      sortOrder: Math.max(-1, ...existing.map((s) => s.sortOrder)) + 1,
      createdBy: userId,
      createdVia: channel,
      createdAt: now,
      updatedAt: now,
    });
    // Un proyecto nace con sus categorías: bug, feature, chore.
    if ((input.templateType ?? 'custom') === 'project') {
      for (const [title, tint] of [['Bug', 'red'], ['Feature', 'blue'], ['Chore', 'gray']] as const) {
        await ctx.db.insert('contextTags', { userId, systemId: id, title, color: tint, isDefault: true, createdAt: now });
      }
    }
    await recordEvent(ctx, {
      userId,
      systemId: id,
      actorChannel: channel,
      action: 'system.create',
      targetType: 'system',
      targetId: id,
      payload: { name: input.name, templateType: input.templateType ?? 'custom' },
    });
    return systemItem((await ctx.db.get(id))!);
  }
}

export const update = kinoZodMutation({
  args: {
    id: zid('systems'),
    name: systemFields.name.optional(),
    identityStatement: systemFields.identityStatement,
    templateType: systemFields.templateType,
    energyIdeal: systemFields.energyIdeal,
    color: systemFields.color.optional(),
    icon: z.string().max(50).optional(),
    expectedFrequency: systemFields.expectedFrequency,
    triggerContext: systemFields.triggerContext,
    metadata: systemMetadataSchema.nullable().optional(),
  },
  handler: async (ctx, { id, ...data }) => {
    const system = await ownSystem(ctx, ctx.user._id, id);
    if (system.isInbox) forbidden('Cannot modify or delete the Inbox system');
    const patch: Partial<Doc<'systems'>> = { updatedAt: Date.now() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.identityStatement !== undefined) patch.identityStatement = data.identityStatement;
    if (data.templateType !== undefined) patch.templateType = data.templateType;
    if (data.energyIdeal !== undefined) patch.energyIdeal = data.energyIdeal;
    if (data.color !== undefined) patch.color = data.color as Doc<'systems'>['color'];
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.expectedFrequency !== undefined) patch.expectedFrequency = data.expectedFrequency;
    if (data.triggerContext !== undefined) patch.triggerContext = data.triggerContext;
    if (data.metadata !== undefined) patch.metadata = data.metadata ?? undefined;
    await ctx.db.patch(id, patch);
    const actualizado = (await ctx.db.get(id))!;
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: id,
      actorChannel: ctx.channel,
      action: 'system.update',
      targetType: 'system',
      targetId: id,
      payload: diferencias(system, actualizado),
    });
    return systemItem(actualizado);
  },
});

export const remove = kinoZodMutation({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const system = await ownSystem(ctx, ctx.user._id, id);
    if (system.isInbox) forbidden('Cannot deactivate Inbox');
    await ctx.db.patch(id, { isActive: false, updatedAt: Date.now() });
    // Archivar, no borrar: apagar `isActive` es todo lo que pasa, y sus siete
    // cascadas de Postgres no ocurren a propósito.
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: id,
      actorChannel: ctx.channel,
      action: 'system.remove',
      targetType: 'system',
      targetId: id,
      payload: { name: system.name, isActive: true },
    });
    return null;
  },
});

/**
 * **Sin fila en el log**, por lo mismo que el reorden de tareas: `sortOrder` es
 * el orden de una lista en pantalla y no una propiedad del sistema, y un solo
 * arrastre escribiría una fila por sistema sin nada que deshacer en ninguna.
 */
export const reorder = kinoZodMutation({
  args: { systemIds: z.array(zid('systems')) },
  handler: async (ctx, { systemIds }) => {
    const now = Date.now();
    for (const [index, id] of systemIds.entries()) {
      const system = await ctx.db.get(id);
      if (!system || system.userId !== ctx.user._id) continue;
      await ctx.db.patch(id, { sortOrder: index, updatedAt: now });
    }
    return null;
  },
});
