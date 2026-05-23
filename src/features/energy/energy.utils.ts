import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Task } from '@/features/tasks/tasks.types';

const PRIORITY_SCORE: Record<string, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 15,
};

function urgencyScore(dueDate: string | null | undefined, today: Date): number {
  if (!dueDate) return 0;
  const due = parseISO(dueDate);
  const daysDiff = differenceInCalendarDays(due, today);
  if (daysDiff < 0) return 100;
  if (daysDiff === 0) return 80;
  if (daysDiff === 1) return 50;
  if (daysDiff <= 7) return 25;
  return 0;
}

function ageScore(createdAt: Date, today: Date): number {
  const days = Math.max(0, differenceInCalendarDays(today, createdAt));
  return Math.min(days * 2, 30);
}

export function computeImportance(task: Task, today: Date): number {
  const priority = PRIORITY_SCORE[task.priority ?? 'medium'] ?? 40;
  const urgency = urgencyScore(task.dueDate, today);
  const age = ageScore(task.createdAt, today);
  return 1.0 * urgency + 0.8 * priority + 0.3 * age;
}
