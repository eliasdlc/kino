import type { Id } from '../_generated/dataModel';

// Cómo se reparte una tanda de avisos a una persona, sin saber nada de web-push
// ni de Convex. Vive aparte de la acción que envía por dos motivos que son el
// ticket entero: aquí se puede probar que cinco tareas escaladas producen un
// solo aviso, y que lo que no salió no se marca como avisado.

export interface Payload {
  title: string;
  body: string;
  url?: string;
}

export interface Delivery {
  userId: Id<'users'>;
  dueToday: Array<{ id: Id<'tasks'>; title: string }>;
  dueTomorrow: Array<{ id: Id<'tasks'>; title: string }>;
  reminders: Array<{ id: Id<'taskReminders'>; label: string | null; taskTitle: string }>;
  escalations: Array<{ id: Id<'tasks'>; title: string; priority: string }>;
}

export interface Delivered {
  dueToday: Id<'tasks'>[];
  dueTomorrow: Id<'tasks'>[];
  reminders: Id<'taskReminders'>[];
  escalations: Id<'tasks'>[];
}

/** Lo urgente primero, que es lo que nombra el aviso agrupado. */
const ORDEN: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Una tarea por su nombre; varias, la primera y cuántas más. */
export function summary(items: Array<{ title: string }>): string {
  const rest = items.length - 1;
  return items.length === 1 ? items[0]!.title : `${items[0]!.title} y ${rest} tarea${rest > 1 ? 's' : ''} más`;
}

/**
 * El aviso de las tareas escaladas, agrupado. La cifra va primero porque es lo
 * que se lee en la pantalla de bloqueo antes de decidir si desbloqueas, y el
 * sujeto de la frase son las tareas, nunca Kino.
 */
export function escalationPayload(tasks: Delivery['escalations']): Payload {
  const ordenadas = [...tasks].sort((a, b) => (ORDEN[a.priority] ?? 9) - (ORDEN[b.priority] ?? 9));
  const n = ordenadas.length;
  return {
    title: `${n} ${n === 1 ? 'tarea sin completar' : 'tareas sin completar'}`,
    body: summary(ordenadas),
    url: '/tasks',
  };
}

/**
 * Reparte la tanda de una persona y devuelve **sólo lo que se entregó**. Un
 * push rechazado deja su tarea sin marcar, así que el siguiente ciclo del cron
 * lo reintenta; marcarlo igual le quitaba su reintento para siempre.
 */
export async function repartir(
  entry: Delivery,
  send: (payload: Payload) => Promise<boolean>,
): Promise<{ delivered: Delivered; notified: number }> {
  const delivered: Delivered = { dueToday: [], dueTomorrow: [], reminders: [], escalations: [] };
  let notified = 0;

  if (entry.dueToday.length) {
    const n = entry.dueToday.length;
    if (await send({ title: `Vence hoy${n > 1 ? ` · ${n}` : ''}`, body: summary(entry.dueToday), url: '/tasks' })) {
      delivered.dueToday = entry.dueToday.map((t) => t.id);
      notified += n;
    }
  }
  if (entry.dueTomorrow.length) {
    const n = entry.dueTomorrow.length;
    if (await send({ title: `Vence mañana${n > 1 ? ` · ${n}` : ''}`, body: summary(entry.dueTomorrow), url: '/tasks' })) {
      delivered.dueTomorrow = entry.dueTomorrow.map((t) => t.id);
      notified += n;
    }
  }
  // Los recordatorios sí van uno a uno: cada uno lo puso una persona con su
  // hora y su texto, y juntarlos perdería justo eso.
  for (const reminder of entry.reminders) {
    if (await send({ title: reminder.label ?? 'Recordatorio', body: reminder.taskTitle, url: '/tasks' })) {
      delivered.reminders.push(reminder.id);
      notified += 1;
    }
  }
  if (entry.escalations.length) {
    if (await send(escalationPayload(entry.escalations))) {
      delivered.escalations = entry.escalations.map((t) => t.id);
      notified += entry.escalations.length;
    }
  }

  return { delivered, notified };
}
