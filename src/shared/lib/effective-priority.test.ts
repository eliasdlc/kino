import { describe, expect, it } from 'vitest';
import { effectivePriority, urgencyFloor } from './effective-priority';

/**
 * Lo que se prueba: que la fecha sube la prioridad y nunca la baja. Una tarea
 * crítica que vence dentro de un mes sigue siendo crítica, y una baja que vence
 * mañana cuenta como crítica sin que nadie la toque.
 */

const DIA = 86_400_000;
const AHORA = Date.UTC(2026, 9, 1, 12);

describe('el suelo del calendario', () => {
  it('sube por escalones a 7, 3 y 1 día', () => {
    expect(urgencyFloor(AHORA + 10 * DIA, AHORA)).toBeNull();
    expect(urgencyFloor(AHORA + 7 * DIA, AHORA)).toBe('medium');
    expect(urgencyFloor(AHORA + 3 * DIA, AHORA)).toBe('high');
    expect(urgencyFloor(AHORA + DIA, AHORA)).toBe('critical');
    expect(urgencyFloor(AHORA - 5 * DIA, AHORA)).toBe('critical');
  });

  it('sin fecha no hay urgencia', () => {
    expect(urgencyFloor(undefined, AHORA)).toBeNull();
  });
});

describe('la prioridad que cuenta', () => {
  it('una baja que vence mañana cuenta como crítica y lo dice', () => {
    expect(effectivePriority('low', AHORA + 20 * 3_600_000, AHORA)).toEqual({ priority: 'critical', raised: true });
  });

  it('la fecha nunca baja lo elegido', () => {
    expect(effectivePriority('critical', AHORA + 30 * DIA, AHORA)).toEqual({ priority: 'critical', raised: false });
    expect(effectivePriority('high', AHORA + 5 * DIA, AHORA)).toEqual({ priority: 'high', raised: false });
  });

  it('una tarea terminada vuelve a lo elegido', () => {
    expect(effectivePriority('medium', AHORA - DIA, AHORA, true)).toEqual({ priority: 'medium', raised: false });
  });
});
