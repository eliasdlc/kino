import { describe, expect, it } from 'vitest';
import { findStaleCrons, formatSilence, type LastSuccess } from './cronHealth';

// Que la ausencia de un cron se note. La regla es pura y recibe el `now`, así
// que "el cron dejó de correr anoche" se reproduce entero moviendo el reloj.

const AHORA = new Date('2026-08-27T12:00:00Z').getTime();
const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

function todoBien(): LastSuccess[] {
  return [
    { job: 'daily-snapshot', at: AHORA - 3 * HORA },
    { job: 'task-reminders', at: AHORA - 10 * MINUTO },
  ];
}

describe('findStaleCrons', () => {
  it('no avisa de nada cuando los dos corrieron hace poco', () => {
    expect(findStaleCrons(todoBien(), AHORA)).toEqual([]);
  });

  it('detecta que los recordatorios dejaron de correr', () => {
    const ultimas = todoBien().map((e) => (e.job === 'task-reminders' ? { ...e, at: AHORA - 3 * HORA } : e));
    const stale = findStaleCrons(ultimas, AHORA);
    expect(stale).toHaveLength(1);
    expect(stale[0]!.job).toBe('task-reminders');
    expect(stale[0]!.reason).toContain('3 horas');
  });

  it('aguanta una vuelta perdida sin gritar', () => {
    const ultimas = todoBien().map((e) => (e.job === 'task-reminders' ? { ...e, at: AHORA - 30 * MINUTO } : e));
    expect(findStaleCrons(ultimas, AHORA)).toEqual([]);
  });

  it('no haber corrido nunca cuenta como ausencia', () => {
    const stale = findStaleCrons([{ job: 'daily-snapshot', at: AHORA - HORA }, { job: 'task-reminders', at: null }], AHORA);
    expect(stale).toHaveLength(1);
    expect(stale[0]!.reason).toContain('nunca');
    expect(stale[0]!.silentForMs).toBeNull();
  });

  it('un job que la consulta ni devuelve también se considera ausente', () => {
    expect(findStaleCrons([], AHORA)).toHaveLength(2);
  });

  it('cada job tiene su propio umbral: tres horas de silencio no tocan al diario', () => {
    const stale = findStaleCrons([{ job: 'daily-snapshot', at: AHORA - 3 * HORA }, { job: 'task-reminders', at: AHORA - 3 * HORA }], AHORA);
    expect(stale.map((s) => s.job)).toEqual(['task-reminders']);
  });
});

describe('formatSilence', () => {
  it('escala de minutos a horas a días', () => {
    expect(formatSilence(5 * MINUTO)).toBe('5 minutos');
    expect(formatSilence(HORA)).toBe('1 hora');
    expect(formatSilence(3 * HORA)).toBe('3 horas');
    expect(formatSilence(72 * HORA)).toBe('3 días');
  });
});
