import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeImportance,
  computeCapacity,
  computeFatigue,
  computeEffectiveEnergy,
} from './energy.utils';
import type { Task } from '@/features/tasks/tasks.types';

// Medianoche UTC: parseDueDate('YYYY-MM-DD') también parsea a medianoche UTC,
// así differenceInCalendarDays compara los mismos días en cualquier timezone
// (con 12:00:00Z los dueDate date-only caían un día antes en zonas UTC-negativas).
const TODAY = new Date('2026-05-20T00:00:00Z');

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
    metadata: null,
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

describe('computeCapacity', () => {
  it('morning + good sleep at hour 9 returns 90', () => {
    expect(computeCapacity(9, 'morning', 'good')).toBe(90);
  });

  it('morning + poor sleep at hour 9 returns 54 (90 × 0.6)', () => {
    expect(computeCapacity(9, 'morning', 'poor')).toBeCloseTo(54);
  });

  it('evening + good sleep at hour 15 returns 80', () => {
    expect(computeCapacity(15, 'evening', 'good')).toBe(80);
  });

  it('evening + partial sleep at hour 8 returns 16 (20 × 0.8)', () => {
    expect(computeCapacity(8, 'evening', 'partial')).toBeCloseTo(16);
  });

  it('negative hour clamps to hour 0 without throwing', () => {
    expect(() => computeCapacity(-1, 'morning', 'good')).not.toThrow();
    expect(computeCapacity(-1, 'morning', 'good')).toBe(computeCapacity(0, 'morning', 'good'));
  });

  it('hour > 23 clamps to hour 23 without throwing', () => {
    expect(() => computeCapacity(25, 'morning', 'good')).not.toThrow();
    expect(computeCapacity(25, 'morning', 'good')).toBe(computeCapacity(23, 'morning', 'good'));
  });

  it('evening peaks higher than morning at hour 15', () => {
    const evening = computeCapacity(15, 'evening', 'good');
    const morning = computeCapacity(15, 'morning', 'good');
    expect(evening).toBeGreaterThan(morning);
  });

  it('morning peaks higher than evening at hour 9', () => {
    const morningVal = computeCapacity(9, 'morning', 'good');
    const eveningVal = computeCapacity(9, 'evening', 'good');
    expect(morningVal).toBeGreaterThan(eveningVal);
  });
});

describe('computeFatigue', () => {
  it('0 minutes → 0 fatigue', () => {
    expect(computeFatigue(0)).toBe(0);
  });

  it('90 minutes → 30 fatigue (inflection point)', () => {
    expect(computeFatigue(90)).toBeCloseTo(30);
  });

  it('120 minutes → 40 fatigue (cap)', () => {
    expect(computeFatigue(120)).toBeCloseTo(40);
  });

  it('200 minutes → 40 fatigue (capped, does not exceed)', () => {
    expect(computeFatigue(200)).toBe(40);
  });

  it('45 minutes → ~15 fatigue (linear midpoint)', () => {
    expect(computeFatigue(45)).toBeCloseTo(15);
  });

  it('negative input clamped to 0', () => {
    expect(computeFatigue(-10)).toBe(0);
  });
});

describe('computeEffectiveEnergy', () => {
  it('morning/good at hour 9 with no fatigue returns 90', () => {
    expect(computeEffectiveEnergy(9, 0, 'morning', 'good')).toBe(90);
  });

  it('morning/good at hour 9 after 90 min returns 60 (90 − 30)', () => {
    expect(computeEffectiveEnergy(9, 90, 'morning', 'good')).toBeCloseTo(60);
  });

  it('result never drops below default floor of 20', () => {
    // evening/poor at hour 5 after 120 min: capacity ~3, fatigue 40 → would be negative
    const result = computeEffectiveEnergy(5, 120, 'evening', 'poor');
    expect(result).toBeGreaterThanOrEqual(20);
  });

  it('custom energyFloor is respected', () => {
    const result = computeEffectiveEnergy(5, 120, 'evening', 'poor', 10);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it('fresh start (0 continuous min) matches computeCapacity output', () => {
    const capacity = computeCapacity(10, 'intermediate', 'good');
    const effective = computeEffectiveEnergy(10, 0, 'intermediate', 'good', 0);
    expect(effective).toBeCloseTo(capacity);
  });

  it('long day (200 min continuous) still stays at or above floor', () => {
    const result = computeEffectiveEnergy(22, 200, 'morning', 'poor');
    expect(result).toBeGreaterThanOrEqual(20);
  });
});
