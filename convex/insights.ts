import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { buildEnergyPlan } from '../src/features/energy/energy.planner';
import { CHRONOTYPE_CURVES } from '../src/features/energy/energy.utils';
import { currentHourIn, todayAdvisor } from './energy';
import { notFound } from './lib/errors';
import { kinoZodQuery } from './lib/fn';
import { toTaskRow } from './lib/tasks/row';
import { userToday } from './lib/time';
import { taskItem } from './tasks';

// Lo que un agente pregunta antes de actuar: el contexto de hoy, el patrón
// que manda, dónde se fue la energía, qué conviene ahora y qué sistema se
// quedó parado. Todo son lecturas; las reglas de clasificar y estimar son las
// mismas que tenía la API.

type Ctx = QueryCtx | MutationCtx;
type EnergyBand = 'high' | 'medium' | 'low';
const ACTIVE = new Set(['today', 'tomorrow', 'week']);
const DAY_MS = 86_400_000;

async function aliveTasks(ctx: Ctx, userId: Id<'users'>) {
  return ctx.db
    .query('tasks')
    .withIndex('by_user_alive_status', (q) => q.eq('userId', userId).eq('deletedAt', undefined))
    .collect();
}

async function activeSystems(ctx: Ctx, userId: Id<'users'>) {
  const docs = await ctx.db.query('systems').withIndex('by_user_active', (q) => q.eq('userId', userId).eq('isActive', true)).collect();
  return docs.sort((a, b) => a.sortOrder - b.sortOrder);
}

// ── Contexto ────────────────────────────────────────────────────────────────

export const context = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    const today = userToday(user.timezone);
    const [systems, tasks, advisor] = await Promise.all([activeSystems(ctx, user._id), aliveTasks(ctx, user._id), todayAdvisor(ctx, user)]);
    const checkins = await ctx.db.query('energyCheckins').withIndex('by_user_day_slot', (q) => q.eq('userId', user._id).eq('date', today)).collect();
    const latest = checkins.sort((a, b) => b.createdAt - a.createdAt)[0];
    const todayTasks = tasks.filter((t) => t.status === 'today' && t.parentTaskId === undefined).slice(0, 20);
    return {
      systems: systems.map((s) => ({
        id: s._id,
        name: s.name,
        color: s.color,
        icon: s.icon,
        energyIdeal: s.energyIdeal ?? null,
        isInbox: s.isInbox,
        identityStatement: s.identityStatement ?? null,
      })),
      today: {
        date: today,
        timezone: user.timezone,
        tasksCount: todayTasks.length,
        tasks: todayTasks.map((t) => ({
          id: t._id,
          title: t.title,
          status: t.status,
          energyLevel: t.energyLevel,
          priority: t.priority,
          dueDate: t.dueDate === undefined ? null : new Date(t.dueDate).toISOString(),
          systemId: t.systemId,
        })),
      },
      energyState: latest ? { level: latest.currentLevel, sleepQuality: latest.sleepQuality } : null,
      topPattern: advisor ? { id: advisor.id, label: advisor.label, message: advisor.message, severity: advisor.severity, actionLabel: advisor.actionLabel } : null,
    };
  },
});

export const patterns = kinoZodQuery({
  args: {},
  handler: async (ctx) => (await todayAdvisor(ctx, ctx.user)) ?? { pattern: null },
});

// ── Energía por sistema ─────────────────────────────────────────────────────

const POINTS: Record<string, number> = { high: 5, medium: 3, low: 1 };

export const energyDistribution = kinoZodQuery({
  args: { days: z.number().int().min(1).max(90).default(7) },
  handler: async (ctx, { days }) => {
    const from = Date.now() - days * DAY_MS;
    const tasks = (await aliveTasks(ctx, ctx.user._id)).filter((t) => t.completedAt !== undefined && t.completedAt >= from);
    const bySystem = new Map<string, { systemId: Id<'systems'>; energySpent: number; tasksCompleted: number }>();
    for (const t of tasks) {
      const row = bySystem.get(t.systemId) ?? { systemId: t.systemId, energySpent: 0, tasksCompleted: 0 };
      row.energySpent += POINTS[t.energyLevel] ?? 1;
      row.tasksCompleted += 1;
      bySystem.set(t.systemId, row);
    }
    const rows = [];
    for (const row of bySystem.values()) {
      const system = await ctx.db.get(row.systemId);
      if (system) rows.push({ ...row, systemName: system.name });
    }
    const total = rows.reduce((sum, r) => sum + r.energySpent, 0);
    return {
      period: `${days}d`,
      total,
      systems: rows
        .map((r) => ({ ...r, percentage: total > 0 ? Math.round((r.energySpent / total) * 100) : 0 }))
        .sort((a, b) => b.energySpent - a.energySpent),
    };
  },
});

// ── Sugerencias ─────────────────────────────────────────────────────────────

function slotForHour(hour: number) {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function levelToBand(level: number): EnergyBand {
  if (level >= 65) return 'high';
  if (level >= 35) return 'medium';
  return 'low';
}

const PRIORITY_WEIGHT: Record<string, number> = { critical: 400, high: 300, medium: 200, low: 100 };

function scoreTask(task: Doc<'tasks'>, band: EnergyBand, now: number): number {
  const daysUntilDue = task.dueDate === undefined ? null : Math.ceil((task.dueDate - now) / DAY_MS);
  const overdue = daysUntilDue !== null && daysUntilDue < 0 ? 1000 : 0;
  const priority = PRIORITY_WEIGHT[task.priority] ?? 200;
  const dueSoon = daysUntilDue === null ? 0 : daysUntilDue <= 2 ? 150 : daysUntilDue <= 7 ? 75 : 0;
  const isAdjacent =
    (task.energyLevel === 'high' && band === 'medium') ||
    (task.energyLevel === 'medium' && band !== 'medium') ||
    (task.energyLevel === 'low' && band === 'medium');
  const energyMatch = task.energyLevel === band ? 120 : isAdjacent ? 60 : 0;
  const ageBonus = Math.min(Math.max(0, Math.ceil((now - task.createdAt) / DAY_MS)), 14) * 4;
  return overdue + priority + dueSoon + energyMatch + ageBonus;
}

function buildWhy(task: Doc<'tasks'>, now: number): string {
  const reasons: string[] = [];
  if (task.priority === 'critical') reasons.push('prioridad crítica');
  else if (task.priority === 'high') reasons.push('prioridad alta');
  if (task.dueDate !== undefined) {
    const daysLeft = Math.ceil((task.dueDate - now) / DAY_MS);
    if (daysLeft < 0) reasons.push('vencida');
    else if (daysLeft === 0) reasons.push('vence hoy');
    else if (daysLeft === 1) reasons.push('vence mañana');
    else if (daysLeft <= 7) reasons.push(`vence en ${daysLeft} días`);
  }
  if (task.status === 'today') reasons.push('planeada para hoy');
  return reasons.length > 0 ? reasons.join(', ') : 'mayor importancia relativa';
}

export const suggest = kinoZodQuery({
  args: { limit: z.number().int().min(1).max(10).default(10) },
  handler: async (ctx, { limit }) => {
    const user = ctx.user;
    const now = Date.now();
    const today = userToday(user.timezone, now);
    const currentHour = currentHourIn(user.timezone, now);
    const tasks = (await aliveTasks(ctx, user._id)).filter((t) => ACTIVE.has(t.status) && t.parentTaskId === undefined && t.taskType !== 'idea');

    // La banda de energía actual: el check-in del tramo si lo hay, si no la curva.
    let band: EnergyBand = 'medium';
    const checkins = await ctx.db.query('energyCheckins').withIndex('by_user_day_slot', (q) => q.eq('userId', user._id).eq('date', today)).collect();
    const slotCheckin = checkins.find((c) => c.slot === slotForHour(currentHour));
    const profile = await ctx.db.query('userEnergyProfile').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
    if (slotCheckin) {
      band = levelToBand(slotCheckin.currentLevel);
    } else if (profile && checkins.length > 0) {
      const latest = checkins.sort((a, b) => b.createdAt - a.createdAt)[0]!;
      const plan = buildEnergyPlan({
        tasks: tasks.map(toTaskRow),
        availableHoursPerDay: profile.availableHoursPerDay,
        chronotype: profile.chronotype,
        sleepQuality: latest.sleepQuality,
        energyFloor: profile.energyFloor,
        today: new Date(today),
        learnedCurve: profile.learnedCurve.length === 24 ? profile.learnedCurve : undefined,
      });
      band = levelToBand(plan.projectedCurve[currentHour] ?? 50);
    } else if (profile) {
      band = levelToBand(CHRONOTYPE_CURVES[profile.chronotype][currentHour] ?? 50);
    }

    return tasks
      .map((task) => ({ task, score: scoreTask(task, band, now) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.task.dueDate !== undefined && b.task.dueDate !== undefined) return a.task.dueDate - b.task.dueDate;
        if (a.task.dueDate !== undefined) return -1;
        if (b.task.dueDate !== undefined) return 1;
        return a.task.createdAt - b.task.createdAt;
      })
      .slice(0, limit)
      .map(({ task, score }) => ({ ...taskItem(task), importanceScore: Math.round(score), why: buildWhy(task, now), energyBand: band }));
  },
});

// ── Sistemas parados ────────────────────────────────────────────────────────

/**
 * Actividad = lo más reciente entre la última tarea completada y el último
 * registro de tiempo; sin actividad se mide contra la antigüedad del sistema,
 * para no marcar como abandonado uno recién creado.
 */
export function toStaleSystemRows(
  rows: Array<{ systemId: string; systemName: string; createdAt: Date; lastCompletedAt: string | null; lastLogAt: string | null }>,
  thresholdDays: number,
  now = Date.now(),
) {
  return rows
    .map((r) => {
      const activity = [r.lastCompletedAt, r.lastLogAt].filter((t): t is string => t !== null).map((t) => new Date(t).getTime());
      const reference = activity.length ? Math.max(...activity) : r.createdAt.getTime();
      return { systemId: r.systemId, systemName: r.systemName, daysSinceActivity: Math.floor((now - reference) / DAY_MS) };
    })
    .filter((r) => r.daysSinceActivity >= thresholdDays)
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
}

export const staleSystems = kinoZodQuery({
  args: { days: z.number().int().min(1).max(180).default(14) },
  handler: async (ctx, { days }) => {
    const systems = (await activeSystems(ctx, ctx.user._id)).filter((s) => !s.isInbox);
    const rows = [];
    for (const system of systems) {
      const tasks = await ctx.db.query('tasks').withIndex('by_system_alive_status', (q) => q.eq('systemId', system._id).eq('deletedAt', undefined)).collect();
      const logs = await ctx.db.query('timeLogs').withIndex('by_system_started', (q) => q.eq('systemId', system._id)).collect();
      const lastCompleted = Math.max(0, ...tasks.map((t) => t.completedAt ?? 0));
      const lastLog = Math.max(0, ...logs.map((l) => l.createdAt));
      rows.push({
        systemId: system._id,
        systemName: system.name,
        createdAt: new Date(system.createdAt),
        lastCompletedAt: lastCompleted > 0 ? new Date(lastCompleted).toISOString() : null,
        lastLogAt: lastLog > 0 ? new Date(lastLog).toISOString() : null,
      });
    }
    return toStaleSystemRows(rows, days);
  },
});

// ── Clasificar, estimar y descomponer ───────────────────────────────────────

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

export const classify = kinoZodQuery({
  args: { title: z.string().trim().min(1), description: z.string().optional() },
  handler: async (ctx, { title, description }) => {
    const systems = await activeSystems(ctx, ctx.user._id);
    const tokens = wordTokens([title, description ?? ''].join(' '));
    let best = systems.find((s) => s.isInbox) ?? systems[0];
    let bestScore = 0;
    for (const system of systems.filter((s) => !s.isInbox)) {
      const systemTokens = [...wordTokens(system.name), ...wordTokens(system.identityStatement ?? '')];
      const score = systemTokens.filter((st) => tokens.some((t) => t.includes(st) || st.includes(t))).length;
      if (score > bestScore) {
        bestScore = score;
        best = system;
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
      systemId: best?._id ?? null,
      systemName: best?.name ?? 'Inbox',
      confidence: bestScore > 0 ? ('medium' as const) : ('low' as const),
      suggestedPriority,
      note: bestScore === 0 ? 'No encontré palabras clave claras — asignado al sistema más probable por defecto.' : undefined,
    };
  },
});

const ENERGY_KEYWORDS: Record<'high' | 'low', string[]> = {
  high: ['analiz', 'design', 'diseñ', 'architect', 'investig', 'research', 'develop', 'desarroll', 'implement', 'creat', 'present', 'escribir', 'write', 'revis', 'audit', 'plan'],
  low: ['archiv', 'mover', 'move', 'elimin', 'delet', 'copiar', 'copy', 'renombr', 'rename', 'respond', 'reply', 'confirm', 'schedule', 'agendar', 'recordar', 'remind'],
};

/** Minutos por keyword: gana el primero que aparece, como siempre ha sido. */
const TIME_KEYWORDS: Record<string, number> = {
  rápido: 15, quick: 15, pequeño: 15, small: 15,
  reunión: 60, meeting: 60, review: 45, revisión: 45,
  analiz: 90, research: 90, investigar: 90,
  present: 60, deploy: 30,
};

function hasStem(tokens: string[], stem: string): boolean {
  const normalized = normalize(stem).trim();
  return tokens.some((token) => token.startsWith(normalized));
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
}

/** Energía y tiempo estimados a partir del texto. Puro: lo comparten el MCP y la UI. */
export function estimateTaskAttributes(title: string, description?: string) {
  const tokens = wordTokens([title, description ?? ''].join(' '));
  const energyLevel = ENERGY_KEYWORDS.high.some((stem) => hasStem(tokens, stem))
    ? 'high'
    : ENERGY_KEYWORDS.low.some((stem) => hasStem(tokens, stem))
      ? 'low'
      : 'medium';
  let estimatedTime = minutesToTime(30);
  for (const [stem, minutes] of Object.entries(TIME_KEYWORDS)) {
    if (hasStem(tokens, stem)) {
      estimatedTime = minutesToTime(minutes);
      break;
    }
  }
  const basis = energyLevel === 'high' ? 'análisis/diseño/investigación' : energyLevel === 'low' ? 'acción mecánica' : 'trabajo estándar';
  return { energyLevel, estimatedTime, reasoning: `Basado en keywords: "${basis}"` };
}

export const estimate = kinoZodQuery({
  args: { title: z.string().trim().min(1), description: z.string().optional() },
  handler: async (_ctx, { title, description }) => estimateTaskAttributes(title, description),
});

const DECOMPOSITION_GUIDANCE = [
  'Cada subtarea empieza con un verbo y se puede terminar de una sentada.',
  'Nada de subtareas de seguimiento ("revisar avance"): sólo trabajo real.',
  'energyLevel es high, medium o low, con el mismo criterio que estimate_task: high para analizar, diseñar o investigar; low para trabajo mecánico.',
  'Si la tarea ya tiene subtareas, complementalas en vez de repetirlas.',
];

export const decompose = kinoZodQuery({
  args: { taskId: zid('tasks'), count: z.number().finite().optional() },
  handler: async (ctx, { taskId, count = 3 }) => {
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== ctx.user._id || task.deletedAt !== undefined) notFound('Task not found');
    const subtasks = (await ctx.db.query('tasks').withIndex('by_parent', (q) => q.eq('parentTaskId', taskId)).collect()).filter((t) => t.deletedAt === undefined);
    return {
      task: {
        id: task._id,
        title: task.title,
        description: task.description ?? null,
        systemId: task.systemId,
        energyLevel: task.energyLevel,
        estimatedTime: task.estimatedTime ?? null,
      },
      count: Math.min(8, Math.max(2, Math.trunc(count))),
      existingSubtasks: subtasks.map((s) => ({ id: s._id, title: s.title })),
      guidance: DECOMPOSITION_GUIDANCE,
      outputContract: {
        shape: '[{ "title": string, "energyLevel": "high|medium|low", "estimatedMinutes": number }]',
        thenCall: 'bulk_create_tasks',
        thenCallWith: { systemId: task.systemId, parentTaskId: task._id },
      },
    };
  },
});
