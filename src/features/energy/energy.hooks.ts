'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import { useUserSettings } from '@/features/settings/settings.hooks';
import { computeEnergyBudget, type EnergyBudget } from './energy.budget';
import type { CreateCheckinClientInput, UpdateAccuracyInput } from './energy.schemas';
import { api } from '@/shared/api/client';

export const energyKeys = {
  checkins: () => ['energy', 'checkins', 'today'] as const,
  plan: () => ['energy', 'plan', 'today'] as const,
  advisor: () => ['energy', 'advisor'] as const,
};

/**
 * Presupuesto de energía del día, derivado del cache: las tareas del plan de hoy
 * más el límite de ajustes. Sin red propia — se mueve con el patrón optimista de
 * las mutaciones del plan, así que comprometer una tarea lo actualiza al instante.
 *
 * `null` mientras no haya límite cargado: nunca se dibuja un presupuesto inventado.
 */
export function useEnergyBudget(): EnergyBudget | null {
  const { data: planTasks = [] } = useTodayPlanTasks();
  const { data: settings } = useUserSettings();
  if (!settings?.dailyEnergyLimit) return null;
  return computeEnergyBudget(planTasks, settings.dailyEnergyLimit);
}

export function useTodayEnergyPlan() {
  return useQuery({
    queryKey: energyKeys.plan(),
    queryFn: () => api.energy.todayPlan({}),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useTodayCheckins() {
  return useQuery({
    queryKey: energyKeys.checkins(),
    queryFn: () => api.energy.checkins({}),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useEnergyAdvisor() {
  return useQuery({
    queryKey: energyKeys.advisor(),
    queryFn: () => api.energy.advisor({}),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCheckin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<unknown, Error, CreateCheckinClientInput>({
    mutationFn: (data) => api.energy.createCheckin(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: energyKeys.checkins() });
      void queryClient.invalidateQueries({ queryKey: energyKeys.plan() });
      // El ciclo del día ("predije X, confirmaste Y, mejoré Z") lo renderiza el
      // server component del dashboard: sin refresh, el check-in que acabas de
      // dar no aparecería verificado hasta recargar.
      router.refresh();
    },
  });
}

export function useUpdateCheckinAccuracy() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateAccuracyInput>({
    mutationFn: (data) => api.energy.updateAccuracy(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: energyKeys.checkins() });
    },
  });
}
