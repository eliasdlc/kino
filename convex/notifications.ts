import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server';
import { notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { calendarDayInTz, userToday, userTomorrow } from './lib/time';

// Suscripciones push y recordatorios. El envío vive en `pushSend.ts`, que es
// una acción de Node porque `web-push` necesita el runtime de Node.

const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());

function reminderItem(doc: Doc<'taskReminders'>) {
  return {
    id: doc._id,
    taskId: doc.taskId,
    userId: doc.userId,
    remindAt: iso(doc.remindAt)!,
    sentAt: iso(doc.sentAt),
    label: doc.label ?? null,
    source: doc.source,
    createdAt: iso(doc.createdAt)!,
  };
}

// ── Suscripciones ───────────────────────────────────────────────────────────

export const subscribe = kinoZodMutation({
  args: { endpoint: z.string().url(), keys: z.object({ auth: z.string().min(1), p256dh: z.string().min(1) }) },
  handler: async (ctx, { endpoint, keys }) => {
    const existing = await ctx.db.query('pushSubscriptions').withIndex('by_endpoint', (q) => q.eq('endpoint', endpoint)).unique();
    if (existing) await ctx.db.patch(existing._id, { userId: ctx.user._id, authKey: keys.auth, p256dhKey: keys.p256dh });
    else await ctx.db.insert('pushSubscriptions', { userId: ctx.user._id, endpoint, authKey: keys.auth, p256dhKey: keys.p256dh, createdAt: Date.now() });
    return { ok: true as const };
  },
});

export const unsubscribe = kinoZodMutation({
  args: { endpoint: z.string().url() },
  handler: async (ctx, { endpoint }) => {
    const existing = await ctx.db.query('pushSubscriptions').withIndex('by_endpoint', (q) => q.eq('endpoint', endpoint)).unique();
    if (existing && existing.userId === ctx.user._id) await ctx.db.delete(existing._id);
    return null;
  },
});

// ── Recordatorios ───────────────────────────────────────────────────────────

export const reminders = kinoZodQuery({
  args: { taskId: zid('tasks') },
  handler: async (ctx, { taskId }) => {
    const rows = await ctx.db.query('taskReminders').withIndex('by_task', (q) => q.eq('taskId', taskId)).collect();
    return rows.filter((r) => r.userId === ctx.user._id).sort((a, b) => a.remindAt - b.remindAt).map(reminderItem);
  },
});

export const createReminder = kinoZodMutation({
  args: { taskId: zid('tasks'), remindAt: z.string().datetime(), label: z.string().max(255).optional() },
  handler: async (ctx, { taskId, remindAt, label }) => {
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== ctx.user._id || task.deletedAt !== undefined) notFound('Task not found');
    const id = await ctx.db.insert('taskReminders', { taskId, userId: ctx.user._id, remindAt: Date.parse(remindAt), label, source: 'user', createdAt: Date.now() });
    return reminderItem((await ctx.db.get(id))!);
  },
});

export const removeReminder = kinoZodMutation({
  args: { id: zid('taskReminders') },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== ctx.user._id || row.sentAt !== undefined) notFound('Reminder not found');
    await ctx.db.delete(id);
    return { ok: true as const };
  },
});

// ── Lo que el envío necesita, sin identidad: lo llama la acción del cron ───

async function notificationsOn(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const settings = await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', userId)).unique();
  return settings?.notificationsEnabled ?? true;
}

/** Suscripciones de un usuario, para entregarle un push. */
export const subscriptionsOf = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db.query('pushSubscriptions').withIndex('by_user', (q) => q.eq('userId', userId)).collect();
    return rows.map((r) => ({ endpoint: r.endpoint, authKey: r.authKey, p256dhKey: r.p256dhKey }));
  },
});

export const dropSubscription = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const row = await ctx.db.query('pushSubscriptions').withIndex('by_endpoint', (q) => q.eq('endpoint', endpoint)).unique();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

const ESCALATION_LIMIT: Record<string, number> = { critical: 14, high: 7, medium: 4, low: 2 };
const ESCALATION_GAP_MS: Record<string, number> = { critical: 6 * 3_600_000, high: 6 * 3_600_000, medium: 48 * 3_600_000, low: 72 * 3_600_000 };

/**
 * Todo lo que toca avisar ahora, por usuario con suscripción y avisos
 * encendidos: lo que vence hoy y mañana sin avisar, los recordatorios que ya
 * llegaron a su hora, y las tareas vencidas que toca escalar.
 */
export const pendingDeliveries = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const subscribed = new Set((await ctx.db.query('pushSubscriptions').collect()).map((s) => s.userId));
    const out: Array<{
      userId: Id<'users'>;
      dueToday: Array<{ id: Id<'tasks'>; title: string }>;
      dueTomorrow: Array<{ id: Id<'tasks'>; title: string }>;
      reminders: Array<{ id: Id<'taskReminders'>; label: string | null; taskTitle: string }>;
      escalations: Array<{ id: Id<'tasks'>; title: string; priority: string }>;
    }> = [];
    for (const userId of subscribed) {
      const user = await ctx.db.get(userId);
      if (!user || !(await notificationsOn(ctx, userId))) continue;
      const tz = user.timezone;
      const [today, tomorrow] = [userToday(tz, now), userTomorrow(tz, now)];
      const tasks = (await ctx.db.query('tasks').withIndex('by_user_alive_status', (q) => q.eq('userId', userId).eq('deletedAt', undefined)).collect()).filter(
        (t) => t.status !== 'done' && t.completedAt === undefined,
      );
      const dayOf = (t: Doc<'tasks'>) => (t.dueDate === undefined ? null : calendarDayInTz(t.dueDate, tz));
      const dueToday = tasks.filter((t) => !t.notifiedDueDay && dayOf(t) === today).map((t) => ({ id: t._id, title: t.title }));
      const dueTomorrow = tasks.filter((t) => !t.notifiedBeforeDay && dayOf(t) === tomorrow).map((t) => ({ id: t._id, title: t.title }));
      const escalations = tasks
        .filter((t) => {
          const day = dayOf(t);
          if (!t.notifiedDueDay || day === null || day > today) return false;
          if (t.reminderCount >= (ESCALATION_LIMIT[t.priority] ?? 0)) return false;
          return t.lastRemindedAt === undefined || t.lastRemindedAt < now - (ESCALATION_GAP_MS[t.priority] ?? Infinity);
        })
        .map((t) => ({ id: t._id, title: t.title, priority: t.priority }));
      const reminders = [];
      for (const task of tasks) {
        for (const r of await ctx.db.query('taskReminders').withIndex('by_task', (q) => q.eq('taskId', task._id)).collect()) {
          if (r.sentAt === undefined && r.remindAt <= now) reminders.push({ id: r._id, label: r.label ?? null, taskTitle: task.title });
        }
      }
      if (dueToday.length || dueTomorrow.length || reminders.length || escalations.length) {
        out.push({ userId, dueToday, dueTomorrow, reminders, escalations });
      }
    }
    return out;
  },
});

/** Deja constancia de lo que sí se entregó; lo que falló se reintenta después. */
export const markDelivered = internalMutation({
  args: {
    dueToday: v.array(v.id('tasks')),
    dueTomorrow: v.array(v.id('tasks')),
    reminders: v.array(v.id('taskReminders')),
    escalations: v.array(v.id('tasks')),
  },
  handler: async (ctx, delivered) => {
    const now = Date.now();
    for (const id of delivered.dueToday) await ctx.db.patch(id, { notifiedDueDay: true });
    for (const id of delivered.dueTomorrow) await ctx.db.patch(id, { notifiedBeforeDay: true });
    for (const id of delivered.reminders) await ctx.db.patch(id, { sentAt: now });
    for (const id of delivered.escalations) {
      const task = await ctx.db.get(id);
      if (task) await ctx.db.patch(id, { reminderCount: task.reminderCount + 1, lastRemindedAt: now });
    }
    return null;
  },
});
