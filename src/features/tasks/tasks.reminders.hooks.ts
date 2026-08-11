"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderKeys } from "./tasks.keys";

/**
 * Recordatorios de una tarea.
 *
 * Extraído de tasks.hooks.ts en KIN-146 (FE-05). Traslado literal: el
 * comportamiento no cambia. `tasks.hooks.ts` sigue reexportando todo, así que
 * ningún consumidor tuvo que cambiar de import.
 */
export interface TaskReminder {
  id: string;
  taskId: string;
  userId: string;
  remindAt: string;
  sentAt: string | null;
  label: string | null;
  source: 'auto' | 'user';
  createdAt: string;
}




export function useTaskReminders(taskId: string) {
  return useQuery<TaskReminder[]>({
    queryKey: reminderKeys.byTask(taskId),
    queryFn: async () => {
      const res = await fetch(`/api/push/reminders?taskId=${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch reminders');
      return res.json() as Promise<TaskReminder[]>;
    },
    staleTime: 30_000,
  });
}


export function useCreateTaskReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { remindAt: string; label?: string }) => {
      const res = await fetch('/api/push/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...data }),
      });
      if (!res.ok) throw new Error('Failed to create reminder');
      return res.json() as Promise<TaskReminder>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.byTask(taskId) });
    },
    onError: () => {
      toast.error('Error al crear el recordatorio');
    },
  });
}


export function useDeleteTaskReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reminderId: string) => {
      const res = await fetch(`/api/push/reminders/${reminderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete reminder');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.byTask(taskId) });
    },
    onError: () => {
      toast.error('Error al eliminar el recordatorio');
    },
  });
}

