import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

/**
 * Mismo razonamiento que `reorder.sql.test.ts`: pasar de un bucle a una sola
 * sentencia sólo es correcto si conserva los filtros que aislaban cada fila.
 * Perderlos no rompe ningún test funcional, simplemente deja que un id ajeno
 * se cuele en el lote.
 */

const updates = vi.hoisted(() => [] as { values: unknown; where: unknown }[]);

vi.mock('@/shared/db', () => ({
  db: {
    update: () => ({
      set: (values: unknown) => ({
        where: (where: unknown) => {
          updates.push({ values, where });
          return Promise.resolve([]);
        },
      }),
    }),
    transaction: vi.fn(),
    execute: vi.fn(),
  },
}));

const { bulkUpdateTasks } = await import('./tasks.service');

const USER_ID = '4d1e2f3a-5b6c-4d7e-8f9a-0b1c2d3e4f5a';
const IDS = [
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
];

function renderWhere() {
  return new PgDialect().sqlToQuery(updates.at(-1)!.where as SQL);
}

beforeEach(() => {
  updates.length = 0;
});

describe('bulkUpdateTasks · SQL emitido', () => {
  it('emite un solo UPDATE para todo el lote, no uno por tarea', async () => {
    await bulkUpdateTasks(IDS, { priority: 'high' }, USER_ID);

    expect(updates).toHaveLength(1);
  });

  it('filtra por los ids del lote en una sola condición', async () => {
    await bulkUpdateTasks(IDS, { priority: 'high' }, USER_ID);
    const { sql: text, params } = renderWhere();

    expect(text).toContain('"id" in');
    IDS.forEach((id) => expect(params).toContain(id));
  });

  it('conserva el scope por user_id, que es lo que impide colar un id ajeno', async () => {
    await bulkUpdateTasks(IDS, { priority: 'high' }, USER_ID);
    const { sql: text, params } = renderWhere();

    expect(text).toContain('"user_id"');
    expect(params).toContain(USER_ID);
  });

  it('conserva la exclusión de las borradas', async () => {
    await bulkUpdateTasks(IDS, { priority: 'high' }, USER_ID);

    expect(renderWhere().sql).toMatch(/"deleted_at"\s+is null/i);
  });

  it('escribe la prioridad y refresca updated_at', async () => {
    await bulkUpdateTasks(IDS, { priority: 'critical' }, USER_ID);

    expect(updates.at(-1)!.values).toMatchObject({ priority: 'critical' });
    expect(updates.at(-1)!.values).toHaveProperty('updatedAt');
  });

  it('sin prioridad no toca la base: escribir updated_at para no cambiar nada es ruido', async () => {
    await bulkUpdateTasks(IDS, {}, USER_ID);

    expect(updates).toHaveLength(0);
  });

  it('con un lote vacío no toca la base', async () => {
    await bulkUpdateTasks([], { priority: 'high' }, USER_ID);

    expect(updates).toHaveLength(0);
  });
});
