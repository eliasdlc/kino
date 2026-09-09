'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import { useConvexMutation, useConvexQuery } from '@/shared/convex/hooks';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import { useUserSettings } from '@/features/settings/settings.hooks';
import { computeEnergyBudget, type EnergyBudget } from './energy.budget';

/**
 * Presupuesto de energía del día, derivado de las tareas del plan de hoy más
 * el límite de ajustes. `null` mientras no haya límite cargado: nunca se
 * dibuja un presupuesto inventado.
 */
export function useEnergyBudget(): EnergyBudget | null {
  const { data: planTasks = [] } = useTodayPlanTasks();
  const { data: settings } = useUserSettings();
  if (!settings?.dailyEnergyLimit) return null;
  return computeEnergyBudget(planTasks, settings.dailyEnergyLimit);
}

/** El perfil declarado: los cuatro campos que salieron del alta y viven en Ajustes. */
export function useEnergyProfile() {
  return useConvexQuery(api.energy.profile, {});
}

export function useUpdateEnergyProfile() {
  return useConvexMutation(api.energy.updateProfile, {
    onSuccess: () => toast.success('Tu perfil de energía queda guardado'),
    onError: () => toast.error('No se pudo guardar tu perfil de energía'),
  });
}

export function useTodayEnergyPlan() {
  return useConvexQuery(api.energy.todayPlan, {});
}

export function useTodayCheckins() {
  return useConvexQuery(api.energy.checkins, {});
}

export function useEnergyAdvisor() {
  return useConvexQuery(api.energy.advisor, {});
}

export function useCreateCheckin() {
  const router = useRouter();
  return useConvexMutation(api.energy.createCheckin, {
    // El ciclo del día ("predije X, confirmaste Y, mejoré Z") lo renderiza el
    // server component del dashboard: sin refresh no aparecería verificado.
    onSuccess: () => router.refresh(),
  });
}

export function useUpdateCheckinAccuracy() {
  return useConvexMutation(api.energy.updateAccuracy);
}
