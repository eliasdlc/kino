import { describe, expect, it } from 'vitest';
import { CHRONOTYPE_CURVES } from '@/features/energy/energy.utils';
import { findPeakRange } from './curve';

describe('findPeakRange', () => {
  it('finds the morning peak for the morning chronotype', () => {
    const { start, end } = findPeakRange(CHRONOTYPE_CURVES.morning);
    expect(start).toBeGreaterThanOrEqual(8);
    expect(start).toBeLessThanOrEqual(10);
    expect(end).toBe(start + 2);
  });

  it('finds the evening peak for the evening chronotype', () => {
    const { start } = findPeakRange(CHRONOTYPE_CURVES.evening);
    expect(start).toBeGreaterThanOrEqual(14);
    expect(start).toBeLessThanOrEqual(20);
  });
});
