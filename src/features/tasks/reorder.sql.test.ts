import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

/**
 * BE-10 (KIN-147). La reescritura a un solo UPDATE es correcta sólo si conserva
 * los filtros que aislaban cada fila en el bucle anterior. Aquí se renderiza el
 * SQL emitido y se comprueba que siguen ahí: perderlos no rompe ningún test
 * funcional, simplemente deja que un id ajeno se cuele.
 *
 * La semántica contra datos reales se verificó aparte, contra la base, con las
 * cuatro combinaciones que el ticket exige.
 */

const executed = vi.hoisted(() => [] as unknown[]);
vi.mock('@/shared/db', () => ({
  db: {
    execute: (query: unknown) => {
      executed.push(query);
      return Promise.resolve([]);
    },
    transaction: vi.fn(),
  },
}));

const { reorderTasks } = await import('./tasks.service');
const { reorderSystem } = await import('../systems/systems.service');

const USER_ID = '4d1e2f3a-5b6c-4d7e-8f9a-0b1c2d3e4f5a';
const IDS = [
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
];

function render() {
  return new PgDialect().sqlToQuery(executed.at(-1) as SQL);
}

beforeEach(() => {
  executed.length = 0;
});

describe('reorderTasks · SQL emitido', () => {
  it('emite una sola sentencia, no una por fila', async () => {
    await reorderTasks(USER_ID, IDS);

    expect(executed).toHaveLength(1);
  });

  it('usa unnest para emparejar cada id con su posición', async () => {
    await reorderTasks(USER_ID, IDS);
    const { sql: text, params } = render();

    expect(text).toContain('unnest');
    expect(text).toMatch(/::uuid\[\]/);
    expect(text).toMatch(/::int\[\]/);
    expect(params).toContainEqual(IDS);
    expect(params).toContainEqual([0, 1, 2]);
  });

  // Trampa real encontrada al escribir esto: interpolar el array directo en la
  // plantilla `sql` hace que drizzle lo expanda a `($1, $2, $3)` — un
  // constructor de fila, no un array — y Postgres revienta al castearlo a
  // uuid[]. Sólo `sql.param()` lo liga como un único parámetro.
  it('liga cada array como un solo parámetro, no expandido en columnas', async () => {
    await reorderTasks(USER_ID, IDS);
    const { sql: text, params } = render();

    expect(text).toMatch(/unnest\(\$\d+::uuid\[\], \$\d+::int\[\]\)/);
    expect(params).toContainEqual(IDS);
    expect(params).toContainEqual([0, 1, 2]);
  });

  it('conserva el scope por user_id, que es lo que impide colar un id ajeno', async () => {
    await reorderTasks(USER_ID, IDS);
    const { sql: text, params } = render();

    expect(text).toContain('"user_id"');
    expect(params).toContain(USER_ID);
  });

  it('conserva la exclusión de las borradas', async () => {
    await reorderTasks(USER_ID, IDS);

    expect(render().sql).toMatch(/"deleted_at"\s+is null/i);
  });

  it('escribe sobre sort_index sin cualificar la columna del SET', async () => {
    await reorderTasks(USER_ID, IDS);

    expect(render().sql).toMatch(/set\s+"sort_index"\s*=/i);
  });

  it('con un array vacío no toca la base', async () => {
    await reorderTasks(USER_ID, []);

    expect(executed).toHaveLength(0);
  });
});

describe('reorderSystem · SQL emitido', () => {
  it('emite una sola sentencia con unnest y scope por user_id', async () => {
    await reorderSystem(USER_ID, IDS);
    const { sql: text, params } = render();

    expect(executed).toHaveLength(1);
    expect(text).toContain('unnest');
    expect(text).toContain('"user_id"');
    expect(params).toContain(USER_ID);
    expect(params).toContainEqual(IDS);
  });

  it('escribe sobre sort_order', async () => {
    await reorderSystem(USER_ID, IDS);

    expect(render().sql).toMatch(/set\s+"sort_order"\s*=/i);
  });

  it('no filtra por deleted_at, porque systems no tiene soft delete', async () => {
    await reorderSystem(USER_ID, IDS);

    expect(render().sql).not.toContain('deleted_at');
  });

  it('con un array vacío no toca la base', async () => {
    await reorderSystem(USER_ID, []);

    expect(executed).toHaveLength(0);
  });
});
