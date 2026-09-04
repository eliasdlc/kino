'use client';

import type { FunctionReturnType } from 'convex/server';
import { api } from '@convex/_generated/api';
import { useConvexQuery } from '@/shared/convex/hooks';

export type SuggestedTask = FunctionReturnType<typeof api.insights.suggest>[number];

export type EnergyDistribution = FunctionReturnType<typeof api.insights.energyDistribution>;

export type StaleSystem = FunctionReturnType<typeof api.insights.staleSystems>[number];

export function useSuggestedTasks(limit = 10) {
  return useConvexQuery(api.insights.suggest, { limit });
}

export function useEnergyDistribution(days = 7) {
  return useConvexQuery(api.insights.energyDistribution, { days });
}

export function useStaleSystems(days = 14) {
  return useConvexQuery(api.insights.staleSystems, { days });
}

export function useTopPattern() {
  return useConvexQuery(api.insights.patterns, {});
}
