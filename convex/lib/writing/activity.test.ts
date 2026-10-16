import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../_generated/api';
import type { Id } from '../../_generated/dataModel';
import schema from '../../schema';
import { recordWritingActivity, SESSION_GAP_MINUTES } from './activity';

const modules = import.meta.glob('../../**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 7, 9);

async function seed() {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  const t = convexTest(schema, modules);
  const userId = (await t.withIdentity(ana).mutation(api.users.ensure, {})) as Id<'users'>;
  const pageId = await t.run(async (ctx) => {
    const systemId = await ctx.db.insert('systems', { userId, createdBy: userId, createdVia: 'session', name: 'Novela', color: 'purple', templateType: 'writing', icon: 'book', isActive: true, isInbox: false, sortOrder: 0, createdAt: T0, updatedAt: T0 });
    return ctx.db.insert('pages', { userId, systemId, title: 'Capítulo 1', isPinned: false, createdBy: userId, createdVia: 'session', createdAt: T0, updatedAt: T0 });
  });
  /** Guarda a los `minutes` de T0 con ese delta de palabras. */
  const saveAt = async (minutes: number, wordsDelta: number) => {
    vi.setSystemTime(T0 + minutes * MIN);
    await t.run(async (ctx) => recordWritingActivity(ctx, (await ctx.db.get(pageId))!, wordsDelta));
  };
  const sessions = () =>
    t.run(async (ctx) =>
      (await ctx.db.query('timeLogs').collect())
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((log) => ({ startedAt: log.startedAt, endedAt: log.endedAt, durationMinutes: log.durationMinutes, wordsWritten: log.wordsWritten })),
    );
  return { saveAt, sessions };
}

describe('recordWritingActivity', () => {
  afterEach(() => vi.useRealTimers());

  it('un guardado dentro del hueco extiende la sesión, y justo en el borde también', async () => {
    const { saveAt, sessions } = await seed();
    await saveAt(0, 100);
    await saveAt(19, 50);
    await saveAt(19 + SESSION_GAP_MINUTES, 10);
    expect(await sessions()).toEqual([{ startedAt: T0, endedAt: T0 + 39 * MIN, durationMinutes: 39, wordsWritten: 160 }]);
  });

  it('pasado el hueco de veinte minutos abre una sesión nueva', async () => {
    const { saveAt, sessions } = await seed();
    await saveAt(0, 100);
    await saveAt(SESSION_GAP_MINUTES + 1, 30);
    expect(await sessions()).toEqual([
      { startedAt: T0, endedAt: T0, durationMinutes: 0, wordsWritten: 100 },
      { startedAt: T0 + 21 * MIN, endedAt: T0 + 21 * MIN, durationMinutes: 0, wordsWritten: 30 },
    ]);
  });

  it('borrar palabras resta del neto de la sesión, aunque quede negativo', async () => {
    // El diario reconstruye el acumulado restando el neto de cada sesión al
    // total del capítulo, así que una sesión de sólo borrar cuenta en negativo.
    const { saveAt, sessions } = await seed();
    await saveAt(0, 40);
    await saveAt(5, -60);
    await saveAt(60, -15);
    expect(await sessions()).toEqual([
      { startedAt: T0, endedAt: T0 + 5 * MIN, durationMinutes: 5, wordsWritten: -20 },
      { startedAt: T0 + 60 * MIN, endedAt: T0 + 60 * MIN, durationMinutes: 0, wordsWritten: -15 },
    ]);
  });
});
