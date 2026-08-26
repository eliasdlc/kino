"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reminderKeys } from "./tasks.keys";
import { api } from '@/shared/api/client';

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
  return useQuery({
    queryKey: reminderKeys.byTask(taskId),
    queryFn: async () => {
      return api.notifications.reminders({ taskId });
    },
    staleTime: 30_000,
  });
}


export function useCreateTaskReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { remindAt: string; label?: string }) => {
      return api.notifications.createReminder({ taskId, ...data });
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
      await api.notifications.removeReminder({ id: reminderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.byTask(taskId) });
    },
    onError: () => {
      toast.error('Error al eliminar el recordatorio');
    },
  });
}

