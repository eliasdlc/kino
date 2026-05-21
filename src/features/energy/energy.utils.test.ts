import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeImportance } from './energy.utils';
import type { Task } from '@/features/tasks/tasks.types';

const TODAY = new Date('2026-05-20T12:00:00Z');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-id',
    userId: 'user-id',
    systemId: 'system-id',
    parentTaskId: null,
    title: 'Test task',
    description: null,
    status: 'today',
    energyLevel: 'medium',
    priority: 'medium',
    taskType: null,
    dueDate: null,
    startDate: null,
    estimatedTime: null,
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

describe('computeImportance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns baseline for a fresh medium-priority task with no due date', () => {
    const task = makeTask();
    const score = computeImportance(task, TODAY);
    // urgency=0, priority=0.8*40=32, age=0.3*0=0
    expect(score).toBe(32);
  });

  it('critical priority scores higher than high', () => {
    const critical = computeImportance(makeTask({ priority: 'critical' }), TODAY);
    const high = computeImportance(makeTask({ priority: 'high' }), TODAY);
    expect(critical).toBeGreaterThan(high);
  });

  it('overdue task scores higher than due today', () => {
    const overdue = computeImportance(makeTask({ dueDate: '2026-05-19' }), TODAY);
    const dueToday = computeImportance(makeTask({ dueDate: '2026-05-20' }), TODAY);
    expect(overdue).toBeGreaterThan(dueToday);
  });

  it('due today scores higher than due tomorrow', () => {
    const dueToday = computeImportance(makeTask({ dueDate: '2026-05-20' }), TODAY);
    const dueTomorrow = computeImportance(makeTask({ dueDate: '2026-05-21' }), TODAY);
    expect(dueToday).toBeGreaterThan(dueTomorrow);
  });

  it('due this week scores higher than far future', () => {
    const thisWeek = computeImportance(makeTask({ dueDate: '2026-05-25' }), TODAY);
    const future = computeImportance(makeTask({ dueDate: '2026-06-30' }), TODAY);
    expect(thisWeek).toBeGreaterThan(future);
  });

  it('older tasks score higher via age factor', () => {
    const oldTask = makeTask({ createdAt: new Date('2026-04-01T12:00:00Z') });
    const newTask = makeTask({ createdAt: TODAY });
    expect(computeImportance(oldTask, TODAY)).toBeGreaterThan(computeImportance(newTask, TODAY));
  });

  it('age score caps at 30 points', () => {
    const veryOld = makeTask({ createdAt: new Date('2020-01-01T00:00:00Z') });
    const score = computeImportance(veryOld, TODAY);
    // max age contribution: 0.3 * 30 = 9
    // base medium: 32, so max = 41
    expect(score).toBe(32 + 9);
  });

  it('overdue critical task scores highest in cateogorgy', () => {
    const task = makeTask({ priority: 'critical', dueDate: '2026-05-19' });
    const score = computeImportance(task, TODAY);
    // urgency=1.0*100=100, priority=0.8*100=80, age=0
    expect(score).toBe(180);
  });
});
