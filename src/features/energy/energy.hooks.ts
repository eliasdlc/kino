'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCheckinClientInput, UpdateAccuracyInput } from './energy.schemas';
import type { AdvisorWithAction } from './energy.service';
import type { TodayCheckinRow } from './energy.service';

export const energyKeys = {
  checkins: () => ['energy', 'checkins', 'today'] as const,
  plan: () => ['energy', 'plan', 'today'] as const,
  advisor: () => ['energy', 'advisor'] as const,
};

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
