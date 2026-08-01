'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import { useUserSettings } from '@/features/settings/settings.hooks';
import { computeEnergyBudget, type EnergyBudget } from './energy.budget';
import type { CreateCheckinClientInput, UpdateAccuracyInput } from './energy.schemas';
import type { AdvisorWithAction, TodayEnergyPlanResult } from './energy.service';
import type { TodayCheckinRow } from './energy.service';

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
  return useQuery<TodayEnergyPlanResult>({
    queryKey: energyKeys.plan(),
    queryFn: async () => {
      const res = await fetch('/api/energy/plan/today');
      if (!res.ok) throw new Error('Failed to fetch energy plan');
      return res.json() as Promise<TodayEnergyPlanResult>;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useTodayCheckins() {
  return useQuery<TodayCheckinRow[]>({
    queryKey: energyKeys.checkins(),
    queryFn: async () => {
      const res = await fetch('/api/energy/checkin');
      if (!res.ok) throw new Error('Failed to fetch check-ins');
      return res.json() as Promise<TodayCheckinRow[]>;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useEnergyAdvisor() {
  return useQuery<AdvisorWithAction | null>({
    queryKey: energyKeys.advisor(),
    queryFn: async () => {
      const res = await fetch('/api/energy/advisor');
      if (!res.ok) throw new Error('Failed to fetch advisor');
      return res.json() as Promise<AdvisorWithAction | null>;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateCheckin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<unknown, Error, CreateCheckinClientInput>({
    mutationFn: async (data) => {
      const res = await fetch('/api/energy/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save check-in');
      return res.json();
    },
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
    mutationFn: async (data) => {
      const res = await fetch('/api/energy/checkin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update accuracy');
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: energyKeys.checkins() });
    },
  });
}
