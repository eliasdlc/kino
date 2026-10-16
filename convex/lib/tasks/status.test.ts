import { describe, expect, it } from 'vitest';
import { deriveStatusFromDate, findParentViolation } from './status';

describe('findParentViolation', () => {
  // Cadena de padres en memoria: id -> parentId. Simula el lookup de la base.
  const chain = (map: Record<string, string | undefined>) => async (id: string) => map[id];

  it('detecta self-parent (una tarea no puede ser su propio padre)', async () => {
    expect(await findParentViolation('A', 'A', chain({}))).toBe('self');
  });

  it('detecta ciclo directo A→B→A', async () => {
    // Asignar B como padre de A, cuando B ya tiene a A como padre.
    expect(await findParentViolation('A', 'B', chain({ B: 'A' }))).toBe('cycle');
  });

  it('detecta ciclo profundo A→C→B→A', async () => {
    expect(await findParentViolation('A', 'C', chain({ C: 'B', B: 'A' }))).toBe('cycle');
  });

  it('permite un padre válido sin ciclo', async () => {
    expect(await findParentViolation('A', 'B', chain({ B: undefined }))).toBeNull();
    expect(await findParentViolation('A', 'C', chain({ C: 'B', B: undefined }))).toBeNull();
  });

  it('no cuelga ante un ciclo preexistente ajeno al cambio', async () => {
    // B↔C ya forman ciclo entre ellos; asignar B como padre de A no involucra a A.
    expect(await findParentViolation('A', 'B', chain({ B: 'C', C: 'B' }))).toBeNull();
  });
});

describe('deriveStatusFromDate', () => {
  const now = Date.parse('2026-05-18T12:00:00Z');
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

  it('sin fecha de inicio es backlog', () => {
    expect(deriveStatusFromDate(undefined, 'UTC', now)).toBe('backlog');
  });

  it('el día de hoy es today', () => {
    expect(deriveStatusFromDate(day('2026-05-18'), 'UTC', now)).toBe('today');
  });

  it('el día de mañana es tomorrow', () => {
    expect(deriveStatusFromDate(day('2026-05-19'), 'UTC', now)).toBe('tomorrow');
  });

  it('pasado mañana o más tarde es week', () => {
    expect(deriveStatusFromDate(day('2026-05-20'), 'UTC', now)).toBe('week');
    expect(deriveStatusFromDate(day('2026-06-01'), 'UTC', now)).toBe('week');
  });

  it('un día pasado también es week: lo reconcilia el barrido diario', () => {
    expect(deriveStatusFromDate(day('2026-05-17'), 'UTC', now)).toBe('week');
    expect(deriveStatusFromDate(day('2025-01-01'), 'UTC', now)).toBe('week');
  });
});
