import { beforeEach, describe, expect, it, vi } from 'vitest';

// Modelo de la atomicidad de postgres-js: `transaction(fn)` sólo "commitea" los
// inserts staged si el callback resuelve; si lanza, se descartan (rollback). Así
// el test verifica la garantía de BE-04 sin una DB real.
const committed: { table: string; values: unknown }[] = [];
const transactionSpy = vi.fn();

function tableName(table: unknown): string {
  const sym = Object.getOwnPropertySymbols(table).find((s) => s.description?.includes('Name'));
  return (sym ? (table as Record<symbol, unknown>)[sym] : 'unknown') as string;
}

function makeTx(staged: { table: string; values: unknown }[]) {
  return {
    select: () => ({
      from: () => ({
        // Ownership/timezone lookups: siempre encuentran algo válido.
        where: () => Promise.resolve([{ id: 'sys', parentTaskId: null, timezone: 'UTC' }]),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        // Fallo inyectado a mitad de lote: la tarea 'BOOM' revienta el insert.
        if (values.title === 'BOOM') throw new Error('insert failed');
        staged.push({ table: tableName(table), values });
        const returning = () => Promise.resolve([{ id: `id-${staged.length}`, ...values }]);
        // KIN-57 añadió `onConflictDoNothing` a la creación (idempotencia de la
        // cola offline). Sin `clientRequestId` el target no aplica, así que aquí
        // es un paso encadenado que no cambia el resultado.
        return { returning, onConflictDoNothing: () => ({ returning }) };
      },
    }),
    delete: () => ({ where: () => Promise.resolve() }),
  };
}

vi.mock('@/shared/db', () => ({
  db: {
    transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      transactionSpy();
      const staged: { table: string; values: unknown }[] = [];
      // Sólo persiste (commit) si el callback resuelve; si lanza, staged se pierde.
      return Promise.resolve(fn(makeTx(staged))).then((result) => {
        committed.push(...staged);
        return result;
      });
    },
  },
}));

import { bulkCreateTasks } from './tasks.service';
import type { CreateTaskInput } from './tasks.types';

function task(title: string): CreateTaskInput {
  return { systemId: '11111111-1111-1111-1111-111111111111', title } as CreateTaskInput;
}

beforeEach(() => {
  committed.length = 0;
  transactionSpy.mockClear();
});

describe('bulkCreateTasks (BE-04 · atomicidad)', () => {
  it('un fallo a mitad de lote revierte TODO — no quedan tareas parciales', async () => {
    await expect(
      bulkCreateTasks('user-1', [task('ok-1'), task('BOOM'), task('ok-2')]),
    ).rejects.toThrow('insert failed');

    // Con el código viejo (Promise.all de createTask, una tx por tarea) 'ok-1'
    // habría commiteado por su cuenta. Con la tx única del lote, nada persiste.
    expect(committed).toHaveLength(0);
  });

  it('el lote entero corre en UNA sola transacción', async () => {
    await bulkCreateTasks('user-1', [task('a'), task('b'), task('c')]);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(committed).toHaveLength(3);
  });
});
