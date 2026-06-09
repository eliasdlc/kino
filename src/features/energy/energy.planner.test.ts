import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildBudgetPlan, buildEnergyPlan } from './energy.planner';
import type { EnergyPlanOptions } from './energy.planner';
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
    inTodayPlan: false,
    notifiedBeforeDay: false,
    notifiedDueDay: false,
    reminderCount: 0,
    lastRemindedAt: null,
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

describe('buildEnergyPlan', () => {
  const baseOptions: EnergyPlanOptions = {
    tasks: [],
    availableHoursPerDay: 8,
    chronotype: 'intermediate',
    sleepQuality: 'good',
    energyFloor: 20,
    startHour: 9,
    today: TODAY,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty items and deferred when no tasks', () => {
    const result = buildEnergyPlan(baseOptions);
    expect(result.items).toEqual([]);
    expect(result.deferred).toEqual([]);
  });

  it('places a high-energy task at peak hour with adequate effective energy', () => {
    // intermediate/good at hour 9: capacity 80, no fatigue → effectiveEnergy 80 ≥ 60
    const task = makeTask({ energyLevel: 'high', priority: 'high' });
    const result = buildEnergyPlan({ ...baseOptions, tasks: [task] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.effectiveEnergyAtStart).toBeGreaterThanOrEqual(60);
    expect(result.deferred).toHaveLength(0);
  });

  it('defers a high-energy task when effective energy is below threshold', () => {
    // evening/poor at hour 6: capacity = 5 × 0.6 = 3 → well below 60 threshold
    const task = makeTask({ energyLevel: 'high', priority: 'critical' });
    const result = buildEnergyPlan({
      ...baseOptions,
      chronotype: 'evening',
      sleepQuality: 'poor',
      startHour: 6,
      tasks: [task],
    });
    expect(result.items).toHaveLength(0);
    expect(result.deferred).toHaveLength(1);
  });

  it('places medium/low tasks even when energy is moderate', () => {
    // morning/poor at hour 5: capacity = 25 × 0.6 = 15 → below medium threshold (35)
    // medium tasks should still be placed (only high tasks get deferred)
    const medium = makeTask({ energyLevel: 'medium', id: 'med' });
    const low = makeTask({ energyLevel: 'low', id: 'lo' });
    const result = buildEnergyPlan({
      ...baseOptions,
      chronotype: 'morning',
      sleepQuality: 'poor',
      startHour: 5,
      tasks: [medium, low],
    });
    // medium and low are not deferred — floor kicks in
    expect(result.deferred).toHaveLength(0);
    expect(result.items).toHaveLength(2);
  });

  it('inserts a break after 90 min of continuous work', () => {
    // Two 46-min tasks = 92 min continuous → break triggers before third task
    const tasks = [
      makeTask({ id: 'a', estimatedTime: '00:46:00' }),
      makeTask({ id: 'b', estimatedTime: '00:46:00' }),
      makeTask({ id: 'c', estimatedTime: '00:30:00' }),
    ];
    const result = buildEnergyPlan({ ...baseOptions, tasks });
    const thirdItem = result.items.find((item) => item.task.id === 'c');
    expect(thirdItem?.breakBefore).toBe(true);
    expect(result.totalBreakMinutes).toBeGreaterThan(0);
  });

  it('respects budget — excess tasks go to deferred', () => {
    const tasks = Array.from({ length: 20 }, (_, i) =>
      makeTask({ id: String(i), estimatedTime: '00:30:00' }),
    );
    const result = buildEnergyPlan({ ...baseOptions, availableHoursPerDay: 1, tasks });
    const totalPlannedMinutes = result.items.reduce((sum) => sum + 30, 0);
    expect(totalPlannedMinutes).toBeLessThanOrEqual(60);
    expect(result.deferred.length).toBeGreaterThan(0);
  });

  it('projectedCurve has exactly 24 non-negative values', () => {
    const result = buildEnergyPlan(baseOptions);
    expect(result.projectedCurve).toHaveLength(24);
    result.projectedCurve.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('startsHere is true only for the first item', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' }), makeTask({ id: 'c' })];
    const result = buildEnergyPlan({ ...baseOptions, tasks });
    expect(result.items[0]?.startsHere).toBe(true);
    result.items.slice(1).forEach((item) => expect(item.startsHere).toBe(false));
  });

  it('excludes idea tasks entirely', () => {
    const idea = makeTask({ taskType: 'idea', id: 'idea' });
    const todo = makeTask({ taskType: 'todo', id: 'todo' });
    const result = buildEnergyPlan({ ...baseOptions, tasks: [idea, todo] });
    expect(result.items.some((i) => i.task.id === 'idea')).toBe(false);
    expect(result.deferred.some((t) => t.id === 'idea')).toBe(false);
  });

  it('excludes soft-deleted tasks entirely', () => {
    const deleted = makeTask({ id: 'del', deletedAt: new Date() });
    const result = buildEnergyPlan({ ...baseOptions, tasks: [deleted] });
    expect(result.items).toHaveLength(0);
    expect(result.deferred).toHaveLength(0);
  });

  it('totalBreakMinutes matches actual break insertions', () => {
    // Two 50-min tasks → 100 min continuous → one break (10 min)
    const tasks = [
      makeTask({ id: 'x', estimatedTime: '00:50:00' }),
      makeTask({ id: 'y', estimatedTime: '00:50:00' }),
    ];
    const result = buildEnergyPlan({ ...baseOptions, tasks });
    const itemsWithBreak = result.items.filter((i) => i.breakBefore).length;
    expect(result.totalBreakMinutes).toBe(itemsWithBreak * 10);
  });
});
