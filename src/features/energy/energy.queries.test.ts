import { describe, expect, it } from 'vitest';
import { overdueCountQuery, overdueTasksQuery } from './energy.queries';

/**
 * El aviso del advisor («tienes N vencidas») y el reparto del ritual tienen que
 * contar lo mismo. Antes solo lo pedía un comentario, y las dos consultas
 * divergieron: la del advisor no excluía subtareas, así que el dashboard
 * mostraba «Tienes 3 tareas vencidas» al lado de «Revisión de la semana · 1
 * vencida» — dos números para lo mismo, en la misma pantalla.
 *
 * Se compilan a SQL sin tocar la DB: es lo único que atrapa que una de las dos
 * se quede atrás cuando el predicado cambie.
 */
describe('vencidas: el advisor y el ritual comparten predicado (KIN-130)', () => {
  const USER = '11111111-1111-1111-1111-111111111111';
  const DATE = '2026-08-06';

  it('ambas consultas filtran por el mismo where', () => {
    const lista = overdueTasksQuery(USER, DATE).toSQL();
    const conteo = overdueCountQuery(USER, DATE).toSQL();

    const whereDe = (sql: string) => sql.slice(sql.indexOf(' where '));
    expect(whereDe(lista.sql)).toBe(whereDe(conteo.sql));
    expect(lista.params).toEqual(conteo.params);
  });

  it('excluye subtareas, cerradas y borradas', () => {
    const { sql, params } = overdueCountQuery(USER, DATE).toSQL();

    expect(sql).toContain('"parent_task_id" is null');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"due_date" <');
    expect(sql).toContain('not in');
    expect(params).toContain('done');
    expect(params).toContain('archived');
  });

  it('el conteo cuenta filas en vez de traerlas', () => {
    expect(overdueCountQuery(USER, DATE).toSQL().sql).toContain('COUNT(*)');
  });
});
