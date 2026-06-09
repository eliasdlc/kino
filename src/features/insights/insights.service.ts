import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks, users } from '@/shared/db/schema';
import { getUsersSystems } from '@/features/systems/systems.service';
import { getTodayCheckin, getTodayAdvisor, getTodayEnergyPlan } from '@/features/energy/energy.service';
import { queryEnergyBySystem, queryInactiveSystems } from './insights.queries';
import type { Task } from '@/features/tasks/tasks.types';
import type { CheckinSlot } from '@/features/energy/energy.schemas';

function getTodayDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function getUserTimezone(userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.timezone ?? 'UTC';
}

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
  const currentHour = today.getHours();
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

// ── Stale Systems ──────────────────────────────────────────────────────────

export async function getStaleSystems(userId: string, thresholdDays = 14) {
  return queryInactiveSystems(userId, thresholdDays);
}
