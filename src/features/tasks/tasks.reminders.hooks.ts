"use client";

import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";

/** Un recordatorio tal como llega al cliente. */
export type TaskReminder = FunctionReturnType<typeof api.notifications.reminders>[number];

export function useTaskReminders(taskId: string) {
  return useConvexQuery(api.notifications.reminders, { taskId });
}

export function useCreateTaskReminder(taskId: string) {
  return useConvexMutation(api.notifications.createReminder, {
    map: (data: { remindAt: string; label?: string }) => ({ taskId, ...data }),
    onError: () => toast.error('Error al crear el recordatorio'),
  });
}

export function useDeleteTaskReminder(_taskId: string) {
  return useConvexMutation(api.notifications.removeReminder, {
    map: (reminderId: string) => ({ id: reminderId }),
    onError: () => toast.error('Error al eliminar el recordatorio'),
  });
}
