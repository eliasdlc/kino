import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildBudgetPlan } from './energy.planner';
import type { Task } from '@/features/tasks/tasks.types';

const TODAY = new Date('2026-05-20T12:00:00Z');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    userId: 'user-id',
    systemId: 'system-id',
    parentTaskId: null,
    title: 'Task',
    description: null,
    status: 'today',
    energyLevel: 'medium',
    priority: 'medium',
    taskType: null,
    dueDate: null,
    startDate: null,
    estimatedTime: '00:30:00',
    recurrenceRule: null,
    recurrenceParentId: null,
    folderId: null,
    contextTagId: null,
    externalSource: null,
    sortIndex: 0,
    completedAt: null,
    deletedAt: null,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...overrides,
  };
}

describe('buildBudgetPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty plan when no tasks', () => {
    expect(buildBudgetPlan([], 8, TODAY)).toEqual([]);
  });

  it('marks the first item as startsHere', () => {
    const tasks = [makeTask({ title: 'A' }), makeTask({ title: 'B' })];
    const plan = buildBudgetPlan(tasks, 8, TODAY);
    expect(plan[0].startsHere).toBe(true);
    expect(plan[1].startsHere).toBe(false);
  });

  it('excludes tasks with taskType idea', () => {
    const idea = makeTask({ taskType: 'idea' });
    const todo = makeTask({ taskType: 'todo' });
    const plan = buildBudgetPlan([idea, todo], 8, TODAY);
    expect(plan).toHaveLength(1);
    expect(plan[0].task.taskType).toBe('todo');
  });

  it('excludes soft-deleted tasks', () => {
    const deleted = makeTask({ deletedAt: new Date() });
    const plan = buildBudgetPlan([deleted], 8, TODAY);
    expect(plan).toHaveLength(0);
  });

  it('respects budget — stops when full', () => {
    // 8 hours = 480 min. Each task = 30 min → max 16 tasks.
    const tasks = Array.from({ length: 20 }, (_, i) =>
      makeTask({ id: String(i), estimatedTime: '00:30:00' }),
    );
    const plan = buildBudgetPlan(tasks, 8, TODAY);
    expect(plan.length).toBeLessThanOrEqual(16);
  });

  it('places higher importance task first', () => {
    const low = makeTask({ id: 'low', priority: 'low', dueDate: null });
    const critical = makeTask({ id: 'crit', priority: 'critical', dueDate: '2026-05-19' });
    const plan = buildBudgetPlan([low, critical], 8, TODAY);
    expect(plan[0].task.id).toBe('crit');
  });

  it('uses 30 min default when estimatedTime is null', () => {
    // budget = 1h = 60 min. Two tasks with null estimatedTime (30 min each) should both fit.
    const a = makeTask({ estimatedTime: null });
    const b = makeTask({ estimatedTime: null });
    const plan = buildBudgetPlan([a, b], 1, TODAY);
    expect(plan).toHaveLength(2);
  });

  it('includes tomorrow and week tasks if today has capacity', () => {
    const todayTask = makeTask({ status: 'today', priority: 'high' });
    const weekTask = makeTask({ status: 'week', priority: 'low' });
    const plan = buildBudgetPlan([todayTask, weekTask], 8, TODAY);
    expect(plan.some((p) => p.task.status === 'week')).toBe(true);
  });

  it('skips a task that exceeds remaining budget instead of stopping', () => {
    // budget = 35 min. First task = 30 min, second = 10 min (fits after skip of big tasks).
    const big = makeTask({ id: 'big', priority: 'medium', estimatedTime: '01:00:00' });
    const small = makeTask({ id: 'small', priority: 'low', estimatedTime: '00:10:00' });
    // big is more important but too large. small should be skipped too since big already exceeded.
    // Actually: big (60 min) exceeds 35 min budget → skipped. small (10 min) fits.
    const plan = buildBudgetPlan([big, small], 35 / 60, TODAY);
    expect(plan.some((p) => p.task.id === 'small')).toBe(true);
    expect(plan.some((p) => p.task.id === 'big')).toBe(false);
  });
});
