import { describe, it, expect } from 'vitest';
import {
  computeEnergyBudget,
  crossesLimitWith,
  energyPointsFor,
  mergeCommitted,
  ENERGY_POINTS,
  TIGHT_THRESHOLD_PCT,
  type BudgetTask,
} from './energy.budget';

const t = (energyLevel: string | null, status = 'today'): BudgetTask => ({ energyLevel, status });

describe('energyPointsFor', () => {
  it('pesa high 5, medium 3, low 1', () => {
    expect(energyPointsFor('high')).toBe(5);
    expect(energyPointsFor('medium')).toBe(3);
    expect(energyPointsFor('low')).toBe(1);
  });

  it('cae en medium cuando el nivel falta o es desconocido', () => {
    expect(energyPointsFor(null)).toBe(ENERGY_POINTS.medium);
    expect(energyPointsFor(undefined)).toBe(ENERGY_POINTS.medium);
    expect(energyPointsFor('extreme')).toBe(ENERGY_POINTS.medium);
  });
});

describe('computeEnergyBudget', () => {
  it('mide lo comprometido, no solo lo hecho', () => {
    // 5 + 3 + 1 = 9 comprometidos; solo la high está hecha.
    const budget = computeEnergyBudget(
      [t('high', 'done'), t('medium'), t('low')],
      50,
    );

    expect(budget.committed).toBe(9);
    expect(budget.spent).toBe(5);
    expect(budget.pending).toBe(4);
    expect(budget.remaining).toBe(41);
    expect(budget.state).toBe('ok');
  });

  it('sin tareas queda vacío y en ok', () => {
    const budget = computeEnergyBudget([], 50);
    expect(budget).toMatchObject({
      committed: 0,
      spent: 0,
      pending: 0,
      remaining: 50,
      pct: 0,
      spentPct: 0,
      state: 'ok',
      overBy: 0,
    });
  });

  it('el límite exacto no es sobregiro', () => {
    const budget = computeEnergyBudget(Array.from({ length: 10 }, () => t('high')), 50);
    expect(budget.committed).toBe(50);
    expect(budget.pct).toBe(100);
    expect(budget.overBy).toBe(0);
    expect(budget.state).toBe('tight');
    expect(budget.remaining).toBe(0);
  });

  it('un punto por encima ya es sobregiro y lo cuantifica', () => {
    const budget = computeEnergyBudget([...Array.from({ length: 10 }, () => t('high')), t('low')], 50);
    expect(budget.committed).toBe(51);
    expect(budget.state).toBe('over');
    expect(budget.overBy).toBe(1);
    expect(budget.remaining).toBe(0);
  });

  it('avisa "tight" al cruzar el umbral, antes de romper el presupuesto', () => {
    const justUnder = computeEnergyBudget([t('high'), t('high'), t('high'), t('high')], 25); // 20/25 = 80 %
    expect(justUnder.pct).toBe(80);
    expect(justUnder.state).toBe('ok');

    const atThreshold = computeEnergyBudget(
      [t('high'), t('high'), t('high'), t('high'), t('medium')],
      25,
    ); // 23/25 = 92 %
    expect(atThreshold.pct).toBeGreaterThanOrEqual(TIGHT_THRESHOLD_PCT);
    expect(atThreshold.state).toBe('tight');
  });

  it('acota spentPct a 100 aunque el sobregiro se haya completado entero', () => {
    const budget = computeEnergyBudget(
      Array.from({ length: 12 }, () => t('high', 'done')),
      50,
    );
    expect(budget.committed).toBe(60);
    expect(budget.spent).toBe(60);
    expect(budget.spentPct).toBe(100);
    expect(budget.pct).toBe(120);
    expect(budget.state).toBe('over');
  });

  it('un límite inválido no divide por cero ni inventa sobregiro', () => {
    const budget = computeEnergyBudget([t('high'), t('high')], 0);
    expect(budget.limit).toBe(0);
    expect(budget.committed).toBe(10);
    expect(budget.pct).toBe(0);
    expect(budget.overBy).toBe(0);
    expect(budget.state).toBe('ok');
  });

  it('las tareas hechas siguen contando como comprometidas', () => {
    // El plan de hoy conserva las completadas hasta el rollover: no deben
    // "liberar" presupuesto al marcarse, o la barra bajaría al trabajar.
    const pending = computeEnergyBudget([t('high'), t('high')], 20);
    const done = computeEnergyBudget([t('high', 'done'), t('high', 'done')], 20);
    expect(done.committed).toBe(pending.committed);
    expect(done.pct).toBe(pending.pct);
  });
});

describe('mergeCommitted', () => {
  it('no cuenta dos veces una tarea que ya estaba en el plan', () => {
    const plan = [{ id: 'a', energyLevel: 'high' }, { id: 'b', energyLevel: 'high' }];
    const merged = mergeCommitted(plan, [{ id: 'b', energyLevel: 'high' }, { id: 'c', energyLevel: 'low' }]);

    expect(merged.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(computeEnergyBudget(merged, 50).committed).toBe(11);
  });

  it('re-comprometer solo tareas ya presentes deja el presupuesto igual', () => {
    const plan = [{ id: 'a', energyLevel: 'high' }, { id: 'b', energyLevel: 'medium' }];
    const before = computeEnergyBudget(plan, 20);
    const after = computeEnergyBudget(mergeCommitted(plan, plan), 20);
    expect(after.committed).toBe(before.committed);
  });

  it('con el plan vacío devuelve las candidatas tal cual', () => {
    const candidates = [{ id: 'a', energyLevel: 'low' }];
    expect(mergeCommitted([], candidates)).toEqual(candidates);
  });
});

describe('el día vacío se reconoce por lo comprometido, no por lo que queda (KIN-130)', () => {
  it('con límite válido, remaining 0 nunca es estado ok', () => {
    // La barra tenía un mensaje para el día vacío colgado de `remaining === 0`,
    // inalcanzable: quedarse sin margen implica pct >= 100, que ya es tight/over.
    for (const limit of [1, 7, 50, 500]) {
      const full = computeEnergyBudget(
        Array.from({ length: limit }, () => t('low')),
        limit,
      );
      expect(full.remaining).toBe(0);
      expect(full.state).not.toBe('ok');
    }
  });

  it('el día sin nada comprometido queda en ok con el presupuesto entero libre', () => {
    const empty = computeEnergyBudget([], 50);
    expect(empty.committed).toBe(0);
    expect(empty.remaining).toBe(50);
    expect(empty.state).toBe('ok');
  });
});

describe('crossesLimitWith', () => {
  it('detecta el cruce exacto y solo en el cruce', () => {
    const budget = computeEnergyBudget(Array.from({ length: 9 }, () => t('high')), 50); // 45
    const crossing = crossesLimitWith(budget, t('high')); // 45 + 5 = 50 → no pasa
    expect(crossing.crosses).toBe(false);

    const over = crossesLimitWith(budget, { energyLevel: 'high', status: 'today' });
    expect(over.overBy).toBe(0);

    const tighter = computeEnergyBudget(Array.from({ length: 10 }, () => t('high')), 48); // 50 > 48
    expect(tighter.state).toBe('over');
    // Ya en sobregiro: la siguiente tarea no vuelve a "cruzar", no se repite el aviso.
    expect(crossesLimitWith(tighter, t('low')).crosses).toBe(false);
  });

  it('avisa cuando la tarea empuja por encima del límite', () => {
    const budget = computeEnergyBudget(Array.from({ length: 9 }, () => t('high')), 47); // 45
    const result = crossesLimitWith(budget, t('high')); // 50 > 47
    expect(result.crosses).toBe(true);
    expect(result.overBy).toBe(3);
  });

  it('sin límite útil nunca avisa', () => {
    const budget = computeEnergyBudget([t('high')], 0);
    expect(crossesLimitWith(budget, t('high')).crosses).toBe(false);
  });
});
