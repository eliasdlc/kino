import { describe, it, expect } from 'vitest';
import { detectTopPattern } from './energy.advisor';
import type { SnapshotLike } from './energy.advisor';

const AVAILABLE_HOURS = 8;

function makeSnapshot(overrides: Partial<SnapshotLike> = {}): SnapshotLike {
  return {
    tasksCreated: 3,
    tasksCompleted: 2,
    tasksOverdue: 0,
    criticalCount: 1,
    activeCount: 5,
    completionRate: 0.5,
    ...overrides,
  };
}

describe('detectTopPattern', () => {
  it('returns null when all metrics are healthy', () => {
    const today = makeSnapshot();
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    expect(result).toBeNull();
  });

  it('detects overload when criticalCount > 5', () => {
    const today = makeSnapshot({ criticalCount: 8, activeCount: 10 });
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    expect(result?.id).toBe('overload');
  });

  it('detects overload when activeCount exceeds 2× availableHoursPerDay', () => {
    const today = makeSnapshot({ activeCount: 17, criticalCount: 0 });
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    expect(result?.id).toBe('overload');
  });

  it('detects abandonment when tasksOverdue > 10', () => {
    const today = makeSnapshot({ tasksOverdue: 15 });
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    expect(result?.id).toBe('abandonment');
  });

  it('detects abandonment when recent completion rate is consistently low', () => {
    const today = makeSnapshot({ tasksOverdue: 2 });
    const recent = [
      makeSnapshot({ completionRate: 0.1 }),
      makeSnapshot({ completionRate: 0.15 }),
      makeSnapshot({ completionRate: 0.2 }),
    ];
    const result = detectTopPattern(today, recent, AVAILABLE_HOURS);
    expect(result?.id).toBe('abandonment');
  });

  it('detects disorganization when >70% of active tasks are critical', () => {
    const today = makeSnapshot({ criticalCount: 9, activeCount: 10 });
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    // overload (criticalCount > 5) has higher score than disorganization
    // score overload = 3×3×3=27, disorg = 2×2×3=12 → overload wins
    expect(result?.id).toBe('overload');
  });

  it('detects disorganization exclusively when only that pattern applies', () => {
    // criticalCount=4 (<5 → no overload), ratio=4/5=0.8 → disorganization
    const today = makeSnapshot({ criticalCount: 4, activeCount: 5 });
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    expect(result?.id).toBe('disorganization');
  });

  it('detects underuse when recent activity is consistently low', () => {
    const today = makeSnapshot({ tasksCreated: 1, tasksCompleted: 0 });
    const recent = Array.from({ length: 5 }, () =>
      makeSnapshot({ tasksCreated: 1, tasksCompleted: 0 }),
    );
    const result = detectTopPattern(today, recent, AVAILABLE_HOURS);
    expect(result?.id).toBe('underuse');
  });

  it('returns the highest-scoring pattern when multiple are active', () => {
    // Both overload and abandonment apply: overload score=27, abandonment score=18
    const today = makeSnapshot({ criticalCount: 8, activeCount: 10, tasksOverdue: 15 });
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    expect(result?.id).toBe('overload');
    expect(result?.score).toBe(27);
  });

  it('does not crash with empty recent array (cold start)', () => {
    const today = makeSnapshot();
    expect(() => detectTopPattern(today, [], AVAILABLE_HOURS)).not.toThrow();
  });

  it('does not detect underuse without sufficient recent history (< 3 days)', () => {
    const today = makeSnapshot({ tasksCreated: 0, tasksCompleted: 0 });
    const recent = [makeSnapshot({ tasksCreated: 0, tasksCompleted: 0 })];
    const result = detectTopPattern(today, recent, AVAILABLE_HOURS);
    // underuse requires >= 3 snapshots in recent
    expect(result?.id).not.toBe('underuse');
  });

  it('score equals severity × urgency × actionability', () => {
    const today = makeSnapshot({ criticalCount: 8, activeCount: 10 });
    const result = detectTopPattern(today, [], AVAILABLE_HOURS);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(result!.severity * result!.urgency * result!.actionability);
  });
});
