import { computeImportance } from './energy.utils';
import type { Task } from '@/features/tasks/tasks.types';

export interface PlanItem {
  task: Task;
  startsHere: boolean;
}

const DEFAULT_TASK_MINUTES = 30;

function estimatedMinutes(estimatedTime: string | null | undefined): number {
  if (!estimatedTime) return DEFAULT_TASK_MINUTES;
  // Format: HH:MM:SS
  const parts = estimatedTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  return hours * 60 + minutes;
}

export function buildBudgetPlan(
  tasks: Task[],
  availableHoursPerDay: number,
  today: Date,
): PlanItem[] {
  const budgetMinutes = availableHoursPerDay * 60;

  const candidates = tasks.filter(
    (t) =>
      t.taskType !== 'idea' &&
      t.deletedAt === null &&
      (t.status === 'today' || t.status === 'tomorrow' || t.status === 'week'),
  );

  const sorted = [...candidates].sort(
    (a, b) => computeImportance(b, today) - computeImportance(a, today),
  );

  const plan: PlanItem[] = [];
  let usedMinutes = 0;

  for (const task of sorted) {
    const taskMinutes = estimatedMinutes(task.estimatedTime);
    if (usedMinutes + taskMinutes > budgetMinutes) continue;
    plan.push({ task, startsHere: plan.length === 0 });
    usedMinutes += taskMinutes;
  }

  return plan;
}
