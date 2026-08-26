import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import type { createTaskReminder, getTaskRemindersForTask } from "./notifications.queries";

type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

/**
 * Las notificaciones push y los recordatorios de una tarea.
 *
 * Suscribir y desuscribir exigen la sesión del navegador: operan sobre el
 * `PushSubscription` del navegador, que sólo existe dentro de una sesión de UI.
 */
export const notificationsContract = {
  subscribe: endpoint
    .route({ method: "POST", path: "/push/subscribe", successStatus: 201 })
    .meta({ sessionOnly: true })
    .input(
      z.object({
        endpoint: z.string().url(),
        keys: z.object({ auth: z.string().min(1), p256dh: z.string().min(1) }),
      }),
    )
    .output(output<{ ok: true }>()),

  unsubscribe: endpoint
    .route({ method: "DELETE", path: "/push/unsubscribe", successStatus: 204 })
    .meta({ sessionOnly: true })
    .input(z.object({ endpoint: z.string().url() }))
    .output(noContent()),

  reminders: endpoint
    .route({ method: "GET", path: "/push/reminders" })
    .input(z.object({ taskId: z.string().uuid() }))
    .output(output<Returns<typeof getTaskRemindersForTask>>()),

  createReminder: endpoint
    .route({ method: "POST", path: "/push/reminders", successStatus: 201 })
    .input(
      z.object({
        taskId: z.string().uuid(),
        remindAt: z.string().datetime(),
        label: z.string().max(255).optional(),
      }),
    )
    .output(output<Returns<typeof createTaskReminder>>()),

  removeReminder: endpoint
    .route({ method: "DELETE", path: "/push/reminders/{id}" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<{ ok: true }>()),
};
