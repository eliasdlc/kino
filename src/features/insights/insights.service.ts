import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks } from '@/shared/db/schema';
import { userToday as getTodayDate } from '@/shared/time';
import { getUserTimezone } from '@/shared/time/user-timezone';
import { getUsersSystems } from '@/features/systems/systems.service';
import { getTodayCheckin, getTodayAdvisor, getTodayEnergyPlan, getCurrentHourInTz } from '@/features/energy/energy.service';
import { getTaskById, getSubtasks } from '@/features/tasks/tasks.service';
import { queryEnergyBySystem, queryInactiveSystems } from './insights.queries';
import type { Task } from '@/features/tasks/tasks.types';
import type { CheckinSlot } from '@/features/energy/energy.schemas';

// ── Context ────────────────────────────────────────────────────────────────

export async function getUserContext(userId: string) {
  const [userSystems, checkin, advisor, timezone] = await Promise.all([
    getUsersSystems(userId),
    getTodayCheckin(userId),
    getTodayAdvisor(userId),
    getUserTimezone(userId),
  ]);

  const today = getTodayDate(timezone);

  const todayTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, 'today'),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ),
    )
    .limit(20);

  return {
    systems: userSystems.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      icon: s.icon,
      energyIdeal: s.energyIdeal,
      isInbox: s.isInbox,
      identityStatement: s.identityStatement,
    })),
    today: {
      date: today,
      timezone,
      tasksCount: todayTasks.length,
      tasks: todayTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        energyLevel: t.energyLevel,
        priority: t.priority,
        dueDate: t.dueDate,
        systemId: t.systemId,
      })),
    },
    energyState: checkin
      ? { level: checkin.currentLevel, sleepQuality: checkin.sleepQuality }
      : null,
    topPattern: advisor
      ? {
          id: advisor.id,
          label: advisor.label,
          message: advisor.message,
          severity: advisor.severity,
          actionLabel: advisor.actionLabel,
        }
      : null,
  };
}

// ── Patterns ───────────────────────────────────────────────────────────────

export async function getTopPattern(userId: string) {
  return getTodayAdvisor(userId);
}

// ── Energy Distribution ────────────────────────────────────────────────────

export async function getEnergyDistribution(userId: string, days = 7) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const rows = await queryEnergyBySystem(userId, fromDate);

  const total = rows.reduce((sum, r) => sum + r.energySpent, 0);

  return {
    period: `${days}d`,
    total,
    systems: rows
      .map((r) => ({
        systemId: r.systemId,
        systemName: r.systemName,
        energySpent: r.energySpent,
        tasksCompleted: r.tasksCompleted,
        percentage: total > 0 ? Math.round((r.energySpent / total) * 100) : 0,
      }))
      .sort((a, b) => b.energySpent - a.energySpent),
  };
}

// ── Suggest ────────────────────────────────────────────────────────────────

type EnergyBand = 'high' | 'medium' | 'low';

function getSlotForHour(hour: number): CheckinSlot {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function levelToband(level: number): EnergyBand {
  if (level >= 65) return 'high';
  if (level >= 35) return 'medium';
  return 'low';
}

function scoreTask(task: Task, energyBand: EnergyBand, today: Date): number {
  const PRIORITY_WEIGHT: Record<string, number> = { critical: 400, high: 300, medium: 200, low: 100 };

  const daysUntilDue = task.dueDate
    ? Math.ceil((new Date(task.dueDate).getTime() - today.getTime()) / 86_400_000)
    : null;

  const overdue = daysUntilDue !== null && daysUntilDue < 0 ? 1000 : 0;
  const priority = PRIORITY_WEIGHT[task.priority ?? 'medium'] ?? 200;
  const dueSoon = daysUntilDue === null ? 0 : daysUntilDue <= 2 ? 150 : daysUntilDue <= 7 ? 75 : 0;

  const taskEnergy = task.energyLevel ?? 'medium';
  const isMatch = taskEnergy === energyBand;
  const isAdjacent =
    (taskEnergy === 'high' && energyBand === 'medium') ||
    (taskEnergy === 'medium' && energyBand !== 'medium') ||
    (taskEnergy === 'low' && energyBand === 'medium');
  const energyMatch = isMatch ? 120 : isAdjacent ? 60 : 0;

  const daysSinceCreated = Math.ceil(
    (today.getTime() - new Date(task.createdAt).getTime()) / 86_400_000,
  );
  const ageBonus = Math.min(Math.max(0, daysSinceCreated), 14) * 4;

  return overdue + priority + dueSoon + energyMatch + ageBonus;
}

function buildWhy(task: Task, today: Date): string {
  const reasons: string[] = [];
  if (task.priority === 'critical') reasons.push('prioridad crítica');
  else if (task.priority === 'high') reasons.push('prioridad alta');
  if (task.dueDate) {
    const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - today.getTime()) / 86_400_000);
    if (daysLeft < 0) reasons.push('vencida');
    else if (daysLeft === 0) reasons.push('vence hoy');
    else if (daysLeft === 1) reasons.push('vence mañana');
    else if (daysLeft <= 7) reasons.push(`vence en ${daysLeft} días`);
  }
  if (task.status === 'today') reasons.push('planeada para hoy');
  return reasons.length > 0 ? reasons.join(', ') : 'mayor importancia relativa';
}

export async function getSuggestedTasks(userId: string, limit = 10) {
  const [allTasks, planResult] = await Promise.all([
    db.select().from(tasks).where(
      and(
        eq(tasks.userId, userId),
        // TODO Fase 4: cambiar a inArray(tasks.status, ['action'])
        inArray(tasks.status, ['today', 'tomorrow', 'week']),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ),
    ),
    getTodayEnergyPlan(userId),
  ]);

  const today = new Date();
  const timezone = await getUserTimezone(userId);
  const currentHour = getCurrentHourInTz(timezone);
  const currentSlot = getSlotForHour(currentHour);

  // Determinar banda de energía actual
  let energyBand: EnergyBand = 'medium';
  const slotCheckin = planResult.checkins.find((c) => c.slot === currentSlot);
  if (slotCheckin) {
    energyBand = levelToband(slotCheckin.currentLevel);
  } else if (planResult.energyPlan?.projectedCurve) {
    const projected = planResult.energyPlan.projectedCurve[currentHour] ?? 50;
    energyBand = levelToband(projected);
  }

  // Excluir ideas (no entran al plan del día)
  const candidates = (allTasks as Task[]).filter((t) => t.taskType !== 'idea');

  const scored = candidates
    .map((t) => ({ task: t, score: scoreTask(t, energyBand, today) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // desempate estable: dueDate asc, luego createdAt asc
      if (a.task.dueDate && b.task.dueDate) return a.task.dueDate.localeCompare(b.task.dueDate);
      if (a.task.dueDate) return -1;
      if (b.task.dueDate) return 1;
      return new Date(a.task.createdAt).getTime() - new Date(b.task.createdAt).getTime();
    })
    .slice(0, limit);

  return scored.map(({ task: t, score }) => ({
    ...t,
    importanceScore: Math.round(score),
    why: buildWhy(t, today),
    energyBand,
  }));
}

// ── Classify ────────────────────────────────────────────────────────────────

const PRIORITY_KEYWORDS: Record<string, string[]> = {
  critical: ['urgente', 'urgent', 'asap', 'crítico', 'critical', 'deadline', 'hoy', 'today', 'ahora', 'now'],
  high: ['importante', 'important', 'pronto', 'soon', 'esta semana', 'this week'],
  low: ['algún día', 'someday', 'eventually', 'cuando pueda', 'idea', 'quizás'],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function wordTokens(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function matchScore(tokens: string[], keywords: string[]): number {
  return keywords.filter((kw) => tokens.some((t) => t.includes(normalize(kw)))).length;
}

export async function classifyTask(
  userId: string,
  title: string,
  description?: string,
) {
  const userSystems = await getUsersSystems(userId);

  const text = [title, description ?? ''].join(' ');
  const tokens = wordTokens(text);

  let bestSystem = userSystems.find((s) => s.isInbox) ?? userSystems[0];
  let bestScore = 0;

  for (const system of userSystems.filter((s) => !s.isInbox)) {
    const systemTokens = [
      ...wordTokens(system.name),
      ...wordTokens(system.identityStatement ?? ''),
    ];
    const score = systemTokens.filter((st) =>
      tokens.some((t) => t.includes(st) || st.includes(t)),
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestSystem = system;
    }
  }

  let suggestedPriority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (matchScore(tokens, keywords) > 0) {
      suggestedPriority = priority as typeof suggestedPriority;
      break;
    }
  }

  return {
    systemId: bestSystem?.id ?? null,
    systemName: bestSystem?.name ?? 'Inbox',
    confidence: bestScore > 0 ? 'medium' : 'low',
    suggestedPriority,
    note:
      bestScore === 0
        ? 'No encontré palabras clave claras — asignado al sistema más probable por defecto.'
        : undefined,
  };
}

// ── Estimate ───────────────────────────────────────────────────────────────

/**
 * Estimación de energía y tiempo a partir del texto de una tarea (KIN-148).
 *
 * Vivía dentro de `packages/mcp/src/tools/decompose.ts`, o sea que el modelo de
 * energía de Kino — el concepto central del producto — era una regla de negocio
 * fuera de la app, sin tests y sin endpoint, mientras su hermana `classifyTask`
 * estaba aquí. Es la duplicación que BE-11 existe para evitar.
 *
 * Se movió tal cual salvo por una cosa: allá el match era `includes()` sobre la
 * cadena entera, que cruza fronteras de palabra ("remover" contenía "move" y
 * bajaba la energía a low). Aquí se compara contra los tokens ya normalizados
 * por `wordTokens`, los mismos que usa `classifyTask`, así que ambas reglas
 * comparten convención en vez de divergir.
 */
const ENERGY_KEYWORDS: Record<'high' | 'low', string[]> = {
  high: [
    // `architect`, no `archi`: el stem corto colisionaba con "archivar" y, como
    // la lista alta se evalúa primero, dejaba el `archiv` de la lista baja
    // inalcanzable — archivar recibos salía como energía alta. El bug venía
    // heredado del paquete MCP; se arregla aquí porque aquí hay tests.
    'analiz', 'design', 'diseñ', 'architect', 'investig', 'research', 'develop', 'desarroll',
    'implement', 'creat', 'present', 'escribir', 'write', 'revis', 'audit', 'plan',
  ],
  low: [
    'archiv', 'mover', 'move', 'elimin', 'delet', 'copiar', 'copy', 'renombr', 'rename',
    'respond', 'reply', 'confirm', 'schedule', 'agendar', 'recordar', 'remind',
  ],
};

/**
 * Minutos por keyword. El orden importa y es parte del comportamiento heredado:
 * gana el primero que aparece, no el más específico, así que "review rápido"
 * son 15 minutos y no 45. Se conserva a propósito — corregirlo cambiaría las
 * estimaciones que el usuario ya conoce, y eso es otro ticket.
 */
const TIME_KEYWORDS: Record<string, number> = {
  rápido: 15, quick: 15, pequeño: 15, small: 15,
  reunión: 60, meeting: 60, review: 45, revisión: 45,
  analiz: 90, research: 90, investigar: 90,
  present: 60, deploy: 30,
};

/** Un token cuenta cuando empieza por el stem: "analizar" cae en "analiz". */
function hasStem(tokens: string[], stem: string): boolean {
  const normalized = normalize(stem).trim();
  return tokens.some((token) => token.startsWith(normalized));
}

function estimateEnergy(tokens: string[]): 'high' | 'medium' | 'low' {
  if (ENERGY_KEYWORDS.high.some((stem) => hasStem(tokens, stem))) return 'high';
  if (ENERGY_KEYWORDS.low.some((stem) => hasStem(tokens, stem))) return 'low';
  return 'medium';
}

/** `HH:MM:SS`, que es el formato de la columna `estimated_time` (tipo `time`). */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

function estimateTime(tokens: string[]): string {
  for (const [stem, minutes] of Object.entries(TIME_KEYWORDS)) {
    if (hasStem(tokens, stem)) return minutesToTime(minutes);
  }
  return minutesToTime(30);
}

export function estimateTaskAttributes(title: string, description?: string) {
  const tokens = wordTokens([title, description ?? ''].join(' '));
  const energyLevel = estimateEnergy(tokens);

  return {
    energyLevel,
    estimatedTime: estimateTime(tokens),
    reasoning: `Basado en keywords: "${
      energyLevel === 'high'
        ? 'análisis/diseño/investigación'
        : energyLevel === 'low'
          ? 'acción mecánica'
          : 'trabajo estándar'
    }"`,
  };
}

// ── Decompose ──────────────────────────────────────────────────────────────

/**
 * Reglas de Kino para partir una tarea. Van en la respuesta porque el modelo
 * que llama es quien redacta las subtareas: si las reglas viven en el prompt
 * del adaptador MCP, Kino tiene una segunda definición de "buena subtarea"
 * fuera de Kino. Aquí están junto al resto del dominio.
 */
const DECOMPOSITION_GUIDANCE = [
  'Cada subtarea empieza con un verbo y se puede terminar de una sentada.',
  'Nada de subtareas de seguimiento ("revisar avance"): sólo trabajo real.',
  'energyLevel es high, medium o low, con el mismo criterio que estimate_task: high para analizar, diseñar o investigar; low para trabajo mecánico.',
  'Si la tarea ya tiene subtareas, complementalas en vez de repetirlas.',
];

const MIN_SUBTASKS = 2;
const MAX_SUBTASKS = 8;
const DEFAULT_SUBTASKS = 3;

/**
 * Devuelve todo lo necesario para descomponer una tarea en una sola llamada
 * (KIN-148 / BE-11): la tarea, lo que ya está partido de ella, y el contrato de
 * salida. Quien redacta las subtareas es el modelo que llama al tool — el
 * paquete MCP no decide nada.
 *
 * Compone dos lecturas del lado de la app, que es justo el punto del ticket: si
 * esto viviera en el adaptador serían dos `kinoFetch` encadenados y la decisión
 * de qué hacer entre uno y otro estaría fuera de aquí.
 */
export async function buildDecompositionBrief(
  userId: string,
  taskId: string,
  count = DEFAULT_SUBTASKS,
) {
  const task = await getTaskById(taskId, userId);
  if (!task) return null;

  const existing = await getSubtasks(taskId, userId);

  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      systemId: task.systemId,
      energyLevel: task.energyLevel,
      estimatedTime: task.estimatedTime,
    },
    count: Math.min(MAX_SUBTASKS, Math.max(MIN_SUBTASKS, Math.trunc(count))),
    existingSubtasks: existing.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
    })),
    guidance: DECOMPOSITION_GUIDANCE,
    outputContract: {
      shape: '[{ "title": string, "energyLevel": "high|medium|low", "estimatedMinutes": number }]',
      // El paso de escritura sigue siendo un tool aparte a propósito: así el
      // usuario ve las subtareas propuestas antes de que se creen.
      thenCall: 'bulk_create_tasks',
      thenCallWith: { systemId: task.systemId, parentTaskId: task.id },
    },
  };
}

// ── Stale Systems ──────────────────────────────────────────────────────────

export async function getStaleSystems(userId: string, thresholdDays = 14) {
  return queryInactiveSystems(userId, thresholdDays);
}
