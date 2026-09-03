'use client';

import { useQuery } from '@tanstack/react-query';
import type { TaskTransport } from '@/features/tasks/tasks.types';
import { api } from '@/shared/api/client';

export const insightsKeys = {
  suggested: (limit: number) => ['insights', 'suggested', limit] as const,
  energyDistribution: (days: number) => ['insights', 'energy-distribution', days] as const,
  staleSystems: (days: number) => ['insights', 'stale-systems', days] as const,
  topPattern: () => ['insights', 'pattern'] as const,
};

export type SuggestedTask = TaskTransport & {
  importanceScore: number;
  why: string;
  energyBand: 'high' | 'medium' | 'low';
};

export interface EnergyDistribution {
  period: string;
  total: number;
  systems: Array<{
    systemId: string;
    systemName: string;
    energySpent: number;
    tasksCompleted: number;
    percentage: number;
  }>;
}

export interface StaleSystem {
  systemId: string;
  systemName: string;
  daysSinceActivity: number;
}

export function useSuggestedTasks(limit = 10) {
  return useQuery({
    queryKey: insightsKeys.suggested(limit),
    queryFn: () => api.insights.suggest({ limit }),
    staleTime: 5 * 60_000,
  });
}

export function useEnergyDistribution(days = 7) {
  return useQuery({
    queryKey: insightsKeys.energyDistribution(days),
    queryFn: () => api.insights.energyDistribution({ days }),
    staleTime: 10 * 60_000,
  });
}

export function useStaleSystems(days = 14) {
  return useQuery({
    queryKey: insightsKeys.staleSystems(days),
    queryFn: () => api.insights.staleSystems({ days }),
    staleTime: 10 * 60_000,
  });
}

// KIN-15: endpoint exists at /api/insights/patterns → getTopPattern → getTodayAdvisor
export function useTopPattern() {
  return useQuery({
    queryKey: insightsKeys.topPattern(),
    queryFn: async () => {
      // El endpoint contesta `{ pattern: null }` cuando no hay ninguno; el
      // hook lo traduce a `null` para que el componente pregunte una sola cosa.
      const data = await api.insights.patterns({});
      return data && 'id' in data ? data : null;
    },
    staleTime: 5 * 60_000,
  });
}
