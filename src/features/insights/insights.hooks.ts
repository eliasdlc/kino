'use client';

import { useQuery } from '@tanstack/react-query';
import type { TaskTransport } from '@/features/tasks/tasks.types';
import type { AdvisorWithAction } from '@/features/energy/energy.service';

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
  return useQuery<SuggestedTask[]>({
    queryKey: insightsKeys.suggested(limit),
    queryFn: async () => {
      const res = await fetch(`/api/insights/suggest?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch suggested tasks');
      return res.json() as Promise<SuggestedTask[]>;
    },
    staleTime: 5 * 60_000,
  });
}

export function useEnergyDistribution(days = 7) {
  return useQuery<EnergyDistribution>({
    queryKey: insightsKeys.energyDistribution(days),
    queryFn: async () => {
      const res = await fetch(`/api/insights/energy-distribution?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch energy distribution');
      return res.json() as Promise<EnergyDistribution>;
    },
    staleTime: 10 * 60_000,
  });
}

export function useStaleSystems(days = 14) {
  return useQuery<StaleSystem[]>({
    queryKey: insightsKeys.staleSystems(days),
    queryFn: async () => {
      const res = await fetch(`/api/insights/stale-systems?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch stale systems');
      return res.json() as Promise<StaleSystem[]>;
    },
    staleTime: 10 * 60_000,
  });
}

// KIN-15: endpoint exists at /api/insights/patterns → getTopPattern → getTodayAdvisor
export function useTopPattern() {
  return useQuery<AdvisorWithAction | null>({
    queryKey: insightsKeys.topPattern(),
    queryFn: async () => {
      const res = await fetch('/api/insights/patterns');
      if (!res.ok) throw new Error('Failed to fetch pattern');
      const data = (await res.json()) as AdvisorWithAction | { pattern: null };
      if (data && 'id' in data) return data as AdvisorWithAction;
      return null;
    },
    staleTime: 5 * 60_000,
  });
}
