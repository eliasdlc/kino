'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCheckinInput } from './energy.schemas';

export const energyKeys = {
  checkin: () => ['energy', 'checkin', 'today'] as const,
  plan: () => ['energy', 'plan', 'today'] as const,
};

export function useTodayCheckin() {
  return useQuery({
    queryKey: energyKeys.checkin(),
    queryFn: async () => {
      const res = await fetch('/api/energy/checkin');
      if (!res.ok) throw new Error('Failed to fetch check-in');
      const data = (await res.json()) as { currentLevel: number; sleepQuality: string } | null;
      return data;
    },
    refetchInterval: 5_000,
  });
}

export function useCreateCheckin() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, CreateCheckinInput>({
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
      void queryClient.invalidateQueries({ queryKey: energyKeys.checkin() });
      void queryClient.invalidateQueries({ queryKey: energyKeys.plan() });
    },
  });
}
