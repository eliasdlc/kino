import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks, users } from '@/shared/db/schema';
import { getUsersSystems } from '@/features/systems/systems.service';
import { getTodayCheckin, getTodayAdvisor } from '@/features/energy/energy.service';
import { computeImportance } from '@/features/energy/energy.utils';
import { queryEnergyBySystem, queryInactiveSystems } from './insights.queries';
import type { Task } from '@/features/tasks/tasks.types';

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

type EnergyLevel = 'high' | 'medium' | 'low';

export async function getSuggestedTasks(
  userId: string,
  energyLevel?: EnergyLevel,
  limit = 3,
) {
  const all = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ['today', 'tomorrow', 'week']),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ),
    );

  const today = new Date();

  const candidates = (energyLevel
    ? all.filter((t) => t.energyLevel === energyLevel)
    : all) as Task[];

  const ranked = [...candidates]
    .sort((a, b) => computeImportance(b, today) - computeImportance(a, today))
    .slice(0, limit);

  return ranked.map((t) => {
    const score = computeImportance(t, today);
    const reasons: string[] = [];
    if (t.priority === 'critical') reasons.push('prioridad crítica');
    else if (t.priority === 'high') reasons.push('prioridad alta');
    if (t.dueDate) {
      const daysLeft = Math.ceil(
        (new Date(t.dueDate).getTime() - today.getTime()) / 86_400_000,
      );
      if (daysLeft < 0) reasons.push('vencida');
      else if (daysLeft === 0) reasons.push('vence hoy');
      else if (daysLeft === 1) reasons.push('vence mañana');
    }
    if (t.status === 'today') reasons.push('planeada para hoy');
    return {
      id: t.id,
      title: t.title,
      systemId: t.systemId,
      energyLevel: t.energyLevel,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      importanceScore: Math.round(score),
      why: reasons.length > 0 ? reasons.join(', ') : 'mayor importancia relativa',
    };
  });
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
