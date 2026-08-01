import { describe, expect, it } from 'vitest';
import {
  buildWeeklyRedistribution,
  buildWeeklyRitual,
  nextDays,
  weekdayOf,
  type RitualDay,
} from './energy.ritual';
import { scheduledLoadByDayQuery } from './energy.queries';
import type { Task } from '@/features/tasks/tasks.types';

const TODAY = new Date('2026-08-03'); // lunes

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: `Tarea ${overrides.id}`,
    energyLevel: 'medium',
    priority: 'medium',
    dueDate: '2026-08-01',
    createdAt: new Date('2026-07-01'),
    ...overrides,
  } as Task;
}

function makeDays(dates: string[], limit: number, committed: Record<string, number> = {}): RitualDay[] {
  return dates.map((date) => ({
    date,
    weekday: weekdayOf(date),
    committedPoints: committed[date] ?? 0,
    remainingPoints: Math.max(0, limit - (committed[date] ?? 0)),
  }));
}

describe('weekdayOf', () => {
  it('mapea la fecha al día de semana con lunes primero', () => {
    expect(weekdayOf('2026-08-03')).toBe('mon');
    expect(weekdayOf('2026-08-08')).toBe('sat');
    expect(weekdayOf('2026-08-09')).toBe('sun');
  });
});

describe('nextDays', () => {
  it('devuelve días consecutivos empezando en el dado', () => {
    expect(nextDays('2026-08-03', 3)).toEqual(['2026-08-03', '2026-08-04', '2026-08-05']);
  });

  it('cruza el fin de mes sin saltarse días', () => {
    expect(nextDays('2026-08-30', 3)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
  });
});

describe('buildWeeklyRedistribution', () => {
  const dates = nextDays('2026-08-03', 7);

  it('reparte respetando el presupuesto de cada día', () => {
    // Límite 6 pts/día: caben dos tareas medium (3 pts) por día.
    const tasks = ['a', 'b', 'c'].map((id) => makeTask({ id }));
    const result = buildWeeklyRedistribution(tasks, makeDays(dates, 6), 6, TODAY);

    expect(result.assignments).toHaveLength(3);
    expect(result.leftovers).toHaveLength(0);

    const perDay = new Map<string, number>();
    for (const a of result.assignments) {
      perDay.set(a.date, (perDay.get(a.date) ?? 0) + a.energyPoints);
    }
    for (const points of perDay.values()) expect(points).toBeLessThanOrEqual(6);
  });

  it('no toca los días que ya están llenos', () => {
    const days = makeDays(dates, 5, { '2026-08-03': 5, '2026-08-04': 5 });
    const result = buildWeeklyRedistribution([makeTask({ id: 'a' })], days, 5, TODAY);

    expect(result.assignments[0]?.date).toBe('2026-08-05');
  });

  it('coloca lo más importante primero', () => {
    const urgent = makeTask({ id: 'urgente', priority: 'critical', dueDate: '2026-07-01' });
    const mild = makeTask({ id: 'suave', priority: 'low', dueDate: '2026-08-02' });
    // Un solo día con espacio para una sola tarea.
    const days = makeDays(['2026-08-03'], 3, {});
    const result = buildWeeklyRedistribution([mild, urgent], days, 3, TODAY);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.taskId).toBe('urgente');
    expect(result.leftovers[0]?.taskId).toBe('suave');
  });

  it('lo que no cabe en ningún día se dice, no se amontona', () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ id: String(i) }));
    const result = buildWeeklyRedistribution(tasks, makeDays(['2026-08-03'], 6), 6, TODAY);

    expect(result.assignments).toHaveLength(2); // 3 + 3 = 6
    expect(result.leftovers).toHaveLength(3);
    expect(result.leftovers.every((l) => l.reason === 'no_room')).toBe(true);
    expect(result.leftovers[0]?.explanation).toContain('presupuesto');
  });

  it('una tarea que pesa más que el día completo se marca como demasiado grande', () => {
    const heavy = makeTask({ id: 'heavy', energyLevel: 'high' }); // 5 pts
    const result = buildWeeklyRedistribution([heavy], makeDays(dates, 3), 3, TODAY);

    expect(result.assignments).toHaveLength(0);
    expect(result.leftovers[0]?.reason).toBe('too_big');
  });

  it('los días devueltos reflejan la carga después del reparto', () => {
    const result = buildWeeklyRedistribution(
      [makeTask({ id: 'a', energyLevel: 'high' })],
      makeDays(dates, 10),
      10,
      TODAY,
    );

    const monday = result.days.find((d) => d.date === '2026-08-03');
    expect(monday?.committedPoints).toBe(5);
    expect(monday?.remainingPoints).toBe(5);
  });

  it('sin vencidas no propone nada', () => {
    const result = buildWeeklyRedistribution([], makeDays(dates, 10), 10, TODAY);
    expect(result.assignments).toHaveLength(0);
    expect(result.leftovers).toHaveLength(0);
  });

  it('cada asignación explica por qué ese día', () => {
    const result = buildWeeklyRedistribution([makeTask({ id: 'a' })], makeDays(dates, 10), 10, TODAY);
    expect(result.assignments[0]?.rationale).toContain('Lunes');
    expect(result.assignments[0]?.rationale).toContain('pts');
  });
});

describe('buildWeeklyRitual', () => {
  const base = {
    reviewDay: 'sun' as const,
    today: '2026-08-03',
    timezone: 'America/Santo_Domingo',
    dailyLimit: 10,
    overdue: [makeTask({ id: 'a' })],
    days: makeDays(nextDays('2026-08-03', 7), 10),
    committedToday: [{ energyLevel: 'high', status: 'today' }],
  };

  it('marca isReviewDay solo cuando hoy coincide con el día elegido', () => {
    expect(buildWeeklyRitual({ ...base, todayWeekday: 'sun' }).isReviewDay).toBe(true);
    expect(buildWeeklyRitual({ ...base, todayWeekday: 'mon' }).isReviewDay).toBe(false);
  });

  it('el presupuesto de hoy que reporta es el mismo que ve el dashboard', () => {
    const ritual = buildWeeklyRitual({ ...base, todayWeekday: 'mon' });
    expect(ritual.todayBudget.committed).toBe(5);
    expect(ritual.todayBudget.limit).toBe(10);
    expect(ritual.overdueCount).toBe(1);
  });
});

/**
 * La consulta de carga semanal se compila a SQL sin tocar la DB: red contra un
 * join perdido o una columna huérfana (lección de W2).
 */
describe('consulta de carga programada por día', () => {
  const USER = '11111111-1111-1111-1111-111111111111';
  const TZ = 'America/Santo_Domingo';

  it('agrupa por el día LOCAL del usuario y excluye lo cerrado', () => {
    const { sql, params } = scheduledLoadByDayQuery(USER, TZ, '2026-08-03', '2026-08-09').toSQL();

    expect(sql).toContain('AT TIME ZONE');
    expect(sql).toContain('"start_date" is not null');
    expect(sql).toContain('"parent_task_id" is null');
    expect(params).toContain(TZ);
    expect(params).toContain('2026-08-03');
    expect(params).toContain('done');
  });
});
