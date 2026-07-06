import { describe, it, expect } from 'vitest';
import { toStaleSystemRows, type SystemActivityRow } from './insights.queries';

const DAY = 86_400_000;
const NOW = new Date('2026-07-05T12:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

function row(partial: Partial<SystemActivityRow> & { systemId: string }): SystemActivityRow {
  return {
    systemName: partial.systemId,
    createdAt: new Date(NOW - 100 * DAY),
    lastCompletedAt: null,
    lastLogAt: null,
    ...partial,
  };
}

describe('toStaleSystemRows', () => {
  // UX-01: el bug viejo medía MAX(tasks.createdAt) — un sistema creado hace 100
  // días pero trabajado hoy salía stale. La actividad real lo excluye.
  it('un sistema con una tarea completada hoy nunca es stale, aunque sea viejo', () => {
    const rows = toStaleSystemRows(
      [row({ systemId: 'a', lastCompletedAt: daysAgo(0) })],
      14,
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('cuenta el tiempo logueado como actividad', () => {
    const rows = toStaleSystemRows(
      [row({ systemId: 'a', lastLogAt: daysAgo(1) })],
      14,
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('toma la actividad más reciente entre completar y loguear', () => {
    const rows = toStaleSystemRows(
      [row({ systemId: 'a', lastCompletedAt: daysAgo(30), lastLogAt: daysAgo(2) })],
      14,
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('marca stale un sistema cuya última actividad supera el umbral', () => {
    const rows = toStaleSystemRows(
      [row({ systemId: 'a', lastCompletedAt: daysAgo(20) })],
      14,
      NOW,
    );
    expect(rows).toEqual([
      { systemId: 'a', systemName: 'a', daysSinceActivity: 20 },
    ]);
  });

  it('un sistema sin actividad se mide contra su antigüedad, no contra un sentinela', () => {
    const recien = row({ systemId: 'nuevo', createdAt: new Date(NOW - 3 * DAY) });
    const viejo = row({ systemId: 'viejo', createdAt: new Date(NOW - 40 * DAY) });
    const rows = toStaleSystemRows([recien, viejo], 14, NOW);
    expect(rows.map((r) => r.systemId)).toEqual(['viejo']);
  });

  it('ordena de más a menos abandonado', () => {
    const rows = toStaleSystemRows(
      [
        row({ systemId: 'a', lastCompletedAt: daysAgo(15) }),
        row({ systemId: 'b', lastCompletedAt: daysAgo(40) }),
      ],
      14,
      NOW,
    );
    expect(rows.map((r) => r.systemId)).toEqual(['b', 'a']);
  });
});
