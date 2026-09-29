import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, type QueryCtx } from './_generated/server';
import { forbidden, notFound } from './lib/errors';
import { kinoAction, kinoZodMutation, kinoZodQuery } from './lib/fn';
import { internal } from './_generated/api';
import { userToday } from './lib/time';
import { ajustesDeAviso, avisable, calcularAviso, deFila, recalcularAviso, type AjustesDeAviso } from './lib/avisos';
import { armarResumen, estadoDe, proximoResumen, type Resumen } from './lib/recordatorios';
import { effectivePriority, type Priority } from '../src/shared/lib/effective-priority';
import { completarDesdeAviso } from './tasks';

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
    // `endpoint` es único global, así que sin esta comprobación suscribirse con
    // el endpoint de otra cuenta le pisaba sus claves VAPID y le robaba sus
    // avisos. Un endpoint pertenece a quien lo registró y a nadie más.
    if (existing && existing.userId !== ctx.user._id) forbidden('Ese endpoint ya pertenece a otra cuenta');
    if (existing) await ctx.db.patch(existing._id, { authKey: keys.auth, p256dhKey: keys.p256dh });
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

/**
 * Cuántas filas de cada índice lee una vuelta del cron. Es el lote, no un
 * límite de lo que se avisa: lo que no quepa sale quince minutos después.
 */
const LOTE = 200;

/** Cuánto espera un aviso que no pudo salir por ningún canal antes de reintentarse. */
const REINTENTO_MS = 15 * 60_000;

/** Lo que la acción de posponer compra. */
const POSPONER_MS = 60 * 60_000;

/**
 * Hasta dónde mira el resumen de la mañana: la antelación más larga que puede
 * pedir una tarea (siete días para una crítica) más uno de margen por zona.
 */
const RESUMEN_HORIZONTE_MS = 8 * 86_400_000;

export interface AvisoDeTarea {
  taskId: Id<'tasks'>;
  title: string;
  texto: string;
  vencida: boolean;
  priority: Priority;
}

export interface Entrega {
  userId: Id<'users'>;
  email: string;
  correo: boolean;
  /** Día local de la persona y correos de respaldo que ya lleva en él. */
  dia: string;
  correosHoy: number;
  avisos: AvisoDeTarea[];
  recordatorios: Array<{ id: Id<'taskReminders'>; taskId: Id<'tasks'>; label: string | null; taskTitle: string }>;
  /** `true` si a esta persona le tocaba el resumen en esta vuelta, haya o no algo que decir. */
  tocaResumen: boolean;
  resumen: Resumen | null;
  /** Tareas cuyo próximo aviso escrito no es el que toca: el resumen las repara. */
  reparar: Id<'tasks'>[];
}

/**
 * Todo lo que toca avisar ahora.
 *
 * **Cada lectura va por un índice que es exactamente la pregunta**, y es la
 * mitad del diseño (`AGENTS.md`, restricción 9). Esto corre cada quince
 * minutos y casi siempre no hay nada que entregar:
 *
 *   - `tasks.by_nextReminder`: las tareas a las que ya les tocó su aviso. Una
 *     tarea sin aviso pendiente no se lee nunca, por vieja o vencida que esté.
 *   - `taskReminders.by_sent_remindAt`: los recordatorios puestos a mano.
 *   - `userSettings.by_nextDigest`: las personas a las que ya les tocó el
 *     resumen de la mañana. Sólo para ellas, una vez al día, se leen sus
 *     tareas con fecha por `by_user_alive_due`: lo vencido entra entero, sin
 *     tope por la izquierda, porque el resumen existe para no dejarlo caer.
 */
export const pendientes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tareas = await ctx.db
      .query('tasks')
      .withIndex('by_nextReminder', (q) => q.gte('nextReminderAt', 0).lte('nextReminderAt', now))
      .take(LOTE);
    const recordatorios = await ctx.db
      .query('taskReminders')
      .withIndex('by_sent_remindAt', (q) => q.eq('sentAt', undefined).lte('remindAt', now))
      .take(LOTE);
    const resumenes = await ctx.db
      .query('userSettings')
      .withIndex('by_nextDigest', (q) => q.gte('nextDigestAt', 0).lte('nextDigestAt', now))
      .take(LOTE);

    const usuarios = new Set<Id<'users'>>([
      ...tareas.map((t) => t.userId),
      ...recordatorios.map((r) => r.userId),
      ...resumenes.map((r) => r.userId),
    ]);
    const tocaResumen = new Set(resumenes.map((r) => r.userId));

    const entregas: Entrega[] = [];
    /** Tareas que ya no tienen nada que avisar: se les borra el aviso sin enviar. */
    const limpiar: Id<'tasks'>[] = [];
    /** Recordatorios de quien apagó los avisos: se dan por vistos. */
    const descartar: Id<'taskReminders'>[] = [];

    for (const userId of usuarios) {
      const user = await ctx.db.get(userId);
      const suyas = tareas.filter((t) => t.userId === userId);
      const suyos = recordatorios.filter((r) => r.userId === userId);
      if (!user) {
        limpiar.push(...suyas.map((t) => t._id));
        descartar.push(...suyos.map((r) => r._id));
        continue;
      }
      const fila = await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', userId)).unique();
      const ajustes = deFila(user, fila);
      if (!ajustes.activos) {
        limpiar.push(...suyas.map((t) => t._id));
        descartar.push(...suyos.map((r) => r._id));
        if (tocaResumen.has(userId)) entregas.push(vacia(user, ajustes, fila, now, true));
        continue;
      }

      const entrega = vacia(user, ajustes, fila, now, tocaResumen.has(userId));
      for (const t of suyas) {
        if (!avisable(t)) {
          limpiar.push(t._id);
          continue;
        }
        const { texto, vencida } = estadoDe(t.dueDate, now, ajustes.tz);
        const priority = effectivePriority(t.priority, t.dueDate, now).priority;
        entrega.avisos.push({ taskId: t._id, title: t.title, texto, vencida, priority });
      }
      // El recordatorio manda sobre la fecha de su tarea: se resuelve por su
      // propio id, y la tarea se carga para su título y para saber si sigue viva.
      for (const r of suyos) {
        const task = await ctx.db.get(r.taskId);
        if (!task || task.deletedAt !== undefined || task.status === 'done' || task.completedAt !== undefined) {
          descartar.push(r._id);
          continue;
        }
        entrega.recordatorios.push({ id: r._id, taskId: task._id, label: r.label ?? null, taskTitle: task.title });
      }
      if (entrega.tocaResumen) await llenarResumen(ctx, entrega, userId, ajustes, now);
      entregas.push(entrega);
    }
    return { entregas, limpiar, descartar };
  },
});

function vacia(
  user: Doc<'users'>,
  ajustes: AjustesDeAviso,
  fila: Doc<'userSettings'> | null,
  now: number,
  tocaResumen: boolean,
): Entrega {
  const dia = userToday(ajustes.tz, now);
  return {
    userId: user._id,
    email: user.email,
    correo: ajustes.correo,
    dia,
    correosHoy: fila?.emailDay === dia ? (fila.emailCount ?? 0) : 0,
    avisos: [],
    recordatorios: [],
    tocaResumen,
    resumen: null,
    reparar: [],
  };
}

async function llenarResumen(ctx: QueryCtx, entrega: Entrega, userId: Id<'users'>, ajustes: AjustesDeAviso, now: number) {
  const conFecha = (
    await ctx.db
      .query('tasks')
      .withIndex('by_user_alive_due', (q) =>
        q.eq('userId', userId).eq('deletedAt', undefined).gte('dueDate', 0).lte('dueDate', now + RESUMEN_HORIZONTE_MS),
      )
      .collect()
  ).filter(avisable);
  entrega.resumen = armarResumen(
    conFecha.map((t) => ({ id: t._id, title: t.title, dueDate: t.dueDate, priority: t.priority, intensidad: t.reminderIntensity })),
    ajustes,
    now,
  );
  entrega.reparar = conFecha.filter((t) => calcularAviso(t, ajustes, now) !== t.nextReminderAt).map((t) => t._id);
}

/**
 * Deja constancia de una vuelta del cron para una persona.
 *
 * Un aviso entregado, o sin ningún canal por el que salir, avanza a su
 * siguiente punto del calendario. Uno que tenía canal y falló en todos se
 * reintenta en quince minutos: marcarlo como avisado le quitaba el reintento
 * para siempre.
 */
export const registrar = internalMutation({
  args: {
    userId: v.id('users'),
    avisados: v.array(v.id('tasks')),
    reintentar: v.array(v.id('tasks')),
    recordatorios: v.array(v.id('taskReminders')),
    tocaResumen: v.boolean(),
    reparar: v.array(v.id('tasks')),
    dia: v.string(),
    correos: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const ajustes = await ajustesDeAviso(ctx, user);
    for (const id of args.avisados) {
      const task = await ctx.db.get(id);
      if (!task) continue;
      await ctx.db.patch(id, {
        lastRemindedAt: now,
        reminderCount: task.reminderCount + 1,
        nextReminderAt: calcularAviso(task, ajustes, now),
      });
    }
    for (const id of args.reintentar) {
      const task = await ctx.db.get(id);
      if (task && avisable(task)) await ctx.db.patch(id, { nextReminderAt: now + REINTENTO_MS });
    }
    for (const id of args.recordatorios) await ctx.db.patch(id, { sentAt: now });
    for (const id of args.reparar) {
      const task = await ctx.db.get(id);
      if (task) await recalcularAviso(ctx, task, ajustes, now);
    }
    const fila = await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', args.userId)).unique();
    if (fila) {
      const patch: Partial<Doc<'userSettings'>> = {};
      // El resumen no se reintenta: uno fallido espera a la mañana siguiente
      // en vez de insistir cada quince minutos con el mismo texto.
      if (args.tocaResumen) patch.nextDigestAt = ajustes.activos ? proximoResumen(ajustes.tz, ajustes.resumen, now) : undefined;
      if (args.correos > 0) {
        const previos = fila.emailDay === args.dia ? (fila.emailCount ?? 0) : 0;
        patch.emailDay = args.dia;
        patch.emailCount = previos + args.correos;
      }
      if (Object.keys(patch).length > 0) await ctx.db.patch(fila._id, patch);
    }
    return null;
  },
});

/** Lo que ya no tiene nada que avisar deja de leerse. */
export const limpiar = internalMutation({
  args: { tareas: v.array(v.id('tasks')), recordatorios: v.array(v.id('taskReminders')) },
  handler: async (ctx, { tareas, recordatorios }) => {
    for (const id of tareas) {
      const task = await ctx.db.get(id);
      if (task && task.nextReminderAt !== undefined) await ctx.db.patch(id, { nextReminderAt: undefined });
    }
    const now = Date.now();
    for (const id of recordatorios) {
      const row = await ctx.db.get(id);
      if (row && row.sentAt === undefined) await ctx.db.patch(id, { sentAt: now });
    }
    return null;
  },
});

/**
 * Lo que hace un botón de la notificación. Entra por `convex/http.ts`, que ya
 * comprobó la firma del enlace: aquí sólo se sabe de qué tarea es.
 *
 * Las dos acciones son reversibles, que es lo que permite ofrecerlas sin
 * sesión: «Hecha» se deshace desde la app como cualquier cierre, y «En 1 h»
 * sólo mueve un aviso.
 */
export const accionDesdeAviso = internalMutation({
  args: { taskId: v.id('tasks'), accion: v.union(v.literal('hecha'), v.literal('posponer')) },
  handler: async (ctx, { taskId, accion }) => {
    const task = await ctx.db.get(taskId);
    if (!task || task.deletedAt !== undefined) return { ok: false as const };
    if (accion === 'hecha') {
      if (task.status !== 'done') await completarDesdeAviso(ctx, task);
      return { ok: true as const };
    }
    if (avisable(task)) await ctx.db.patch(taskId, { nextReminderAt: Date.now() + POSPONER_MS });
    return { ok: true as const };
  },
});

// ── Estado visible en Ajustes ───────────────────────────────────────────────

/**
 * Lo que el servidor sabe de los avisos de la persona, para que Ajustes no
 * tenga que fiarse del navegador: cuántos dispositivos tienen push registrado
 * aquí, y si el deployment puede enviar push y correo.
 */
export const estado = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    // Acotado por construcción: una fila por dispositivo de la persona.
    const dispositivos = (await ctx.db.query('pushSubscriptions').withIndex('by_user', (q) => q.eq('userId', ctx.user._id)).collect()).length;
    return {
      dispositivos,
      pushConfigurado: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      correoConfigurado: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
      email: ctx.user.email,
    };
  },
});

/** Para la prueba de Ajustes: a quién y por dónde, sin identidad de por medio. */
export const destinoDePrueba = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user ? { email: user.email } : null;
  },
});

/**
 * «Enviar una prueba» de Ajustes. Cerrada: sólo desde el navegador, porque
 * dispara un correo real y no es algo que un agente tenga que poder repetir.
 */
export const probar = kinoAction(undefined, 'closed')({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ dispositivos: number; push: boolean; pushConfigurado: boolean; correo: boolean; correoConfigurado: boolean }> =>
    ctx.runAction(internal.pushSend.enviarPrueba, { userId: ctx.user._id }),
});
