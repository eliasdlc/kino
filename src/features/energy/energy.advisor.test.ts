import { describe, it, expect } from 'vitest';
import { detectTopPattern } from './energy.advisor';
import type { SnapshotLike } from './energy.advisor';

/**
 * Los dos patrones que quedan. Los otros dos se fueron y no vuelven, y por eso
 * hay un test que lo dice: `underuse` se borró el 8 de septiembre (D-22) porque
 * apuntaba a una ausencia y no a una fila, y su señal ya la da el estado de
 * regreso; `overload` dejó de ser una heurística sobre la instantánea de ayer y
 * pasó a ser la salida del sobregiro, que lee el presupuesto real del día.
 */

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
  it('no dice nada cuando no hay nada que decir', () => {
    expect(detectTopPattern(makeSnapshot(), [])).toBeNull();
  });

  it('ve el abandono con más de diez vencidas', () => {
    expect(detectTopPattern(makeSnapshot({ tasksOverdue: 15 }), [])?.id).toBe('abandonment');
  });

  it('ve el abandono cuando la tasa de cierre lleva días baja', () => {
    const recent = [
      makeSnapshot({ completionRate: 0.1 }),
      makeSnapshot({ completionRate: 0.15 }),
      makeSnapshot({ completionRate: 0.2 }),
    ];
    expect(detectTopPattern(makeSnapshot({ tasksOverdue: 2 }), recent)?.id).toBe('abandonment');
  });

  it('ve el desorden cuando casi todo está marcado como crítico', () => {
    expect(detectTopPattern(makeSnapshot({ criticalCount: 4, activeCount: 5 }), [])?.id).toBe(
      'disorganization',
    );
  });

  it('con los dos activos gana el de más score', () => {
    const today = makeSnapshot({ criticalCount: 9, activeCount: 10, tasksOverdue: 15 });
    const result = detectTopPattern(today, []);
    expect(result?.id).toBe('abandonment');
    expect(result?.score).toBe(18);
  });

  it('un día lleno de críticas ya no se llama sobrecarga aquí', () => {
    // El día que no cabe lo dice `energy.overBudgetExit` con la cifra del
    // presupuesto real. Si alguien reintroduce la heurística, esto falla.
    const today = makeSnapshot({ criticalCount: 8, activeCount: 17 });
    expect(detectTopPattern(today, [])?.id).not.toBe('overload');
  });

  it('poco movimiento no es un patrón: eso lo dice el estado de regreso', () => {
    const quieto = makeSnapshot({ tasksCreated: 1, tasksCompleted: 0, criticalCount: 0, activeCount: 1 });
    const recent = Array.from({ length: 5 }, () => quieto);
    expect(detectTopPattern(quieto, recent)).toBeNull();
  });

  it('no revienta el primer día, sin historial ninguno', () => {
    expect(() => detectTopPattern(makeSnapshot(), [])).not.toThrow();
  });

  it('el score es severidad por urgencia por accionabilidad', () => {
    const result = detectTopPattern(makeSnapshot({ tasksOverdue: 15 }), []);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(result!.severity * result!.urgency * result!.actionability);
  });
});
