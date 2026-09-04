import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { CASCADES } from './cascadas';
import { PG_TABLES } from './tables';

const snake = (field: string) => field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** `tabla.columna -> tabla_destino (regla)`, para comparar listas. */
const line = (from: string, column: string, to: string, onDelete: string) =>
  `${from}.${column} -> ${to} (${onDelete})`;

describe('cascadas', () => {
  it('lista exactamente los ON DELETE que Drizzle declara entre tablas que viajan', () => {
    const pgNames = new Map(
      Object.entries(PG_TABLES).map(([convexName, table]) => [getTableConfig(table).name, convexName]),
    );
    const declared = Object.values(PG_TABLES)
      .flatMap((table) => getTableConfig(table).foreignKeys.map((fk) => ({ table, fk })))
      .flatMap(({ table, fk }) => {
        const ref = fk.reference();
        const to = pgNames.get(getTableConfig(ref.foreignTable).name);
        const onDelete = fk.onDelete ?? 'no action';
        if (!to || onDelete === 'no action') return [];
        return ref.columns.map((column) =>
          line(pgNames.get(getTableConfig(table).name) ?? '?', column.name, to, onDelete),
        );
      })
      .sort();
    const listed = CASCADES.map((c) => line(c.from, snake(c.field), c.to, c.onDelete)).sort();
    expect(listed).toEqual(declared);
  });

  it('cada cascada nombra la mutación que la reproduce', () => {
    for (const cascade of CASCADES) expect(cascade.mutation).toMatch(/^[a-z]+\.remove$/);
  });
});
