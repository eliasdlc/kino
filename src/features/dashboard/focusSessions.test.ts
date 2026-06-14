import { describe, it, expect } from 'vitest';
import { recommendSessions } from './focusSessions';

describe('recommendSessions', () => {
  it('high demand + high energy → deep block first', () => {
    const [primary] = recommendSessions('high', 80);
    expect(primary!.minutes).toBe(50);
  });

  it('high demand + low energy → no deep block, starts with sprint', () => {
    const sessions = recommendSessions('high', 30);
    expect(sessions.map((s) => s.minutes)).toEqual([25, 15]);
    expect(sessions.some((s) => s.minutes === 50)).toBe(false);
  });

  it('high demand + medium energy → sprint first, deep as alternative', () => {
    expect(recommendSessions('high', 55).map((s) => s.minutes)).toEqual([25, 50]);
  });

  it('medium demand scales down when energy is low', () => {
    expect(recommendSessions('medium', 70).map((s) => s.minutes)).toEqual([25, 15]);
    expect(recommendSessions('medium', 30).map((s) => s.minutes)).toEqual([15, 10]);
  });

  it('low demand always offers short sessions', () => {
    expect(recommendSessions('low', 90).map((s) => s.minutes)).toEqual([15, 10]);
  });

  it('always returns exactly two options', () => {
    for (const energy of [10, 50, 90]) {
      for (const demand of ['high', 'medium', 'low'] as const) {
        expect(recommendSessions(demand, energy)).toHaveLength(2);
      }
    }
  });
});
