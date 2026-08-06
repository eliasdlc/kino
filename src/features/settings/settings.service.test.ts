import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock de db: captura qué tabla se upsertea/actualiza y con qué payload, sin
// una DB real. Verifica el ruteo de campos que añadió Fase 2.2 (theme y
// notificationsEnabled van a user_settings; timezone va a users).
const calls: { op: string; table: string; values?: Record<string, unknown>; set?: Record<string, unknown> }[] = [];

function tableName(table: unknown): string {
  const sym = Object.getOwnPropertySymbols(table as object).find((s) =>
    s.description?.includes('Name'),
  );
  return (sym ? (table as Record<symbol, unknown>)[sym] : 'unknown') as string;
}

vi.mock('@/shared/db', () => ({
  db: {
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
          calls.push({ op: 'upsert', table: tableName(table), values, set });
          return Promise.resolve();
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          calls.push({ op: 'update', table: tableName(table), values });
          return Promise.resolve();
        },
      }),
    }),
    select: () => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    }),
  },
}));

import { updateUserSettings } from './settings.service';
import { updateUserSettingsSchema } from './settings.schemas';

const USER = 'user-1';

beforeEach(() => {
  calls.length = 0;
});

describe('updateUserSettings (Fase 2.2 · ruteo de campos)', () => {
  it('persiste el theme en user_settings', async () => {
    await updateUserSettings(USER, { theme: 'dark' });
    const upsert = calls.find((c) => c.op === 'upsert' && c.table === 'user_settings');
    expect(upsert?.values?.theme).toBe('dark');
    expect(upsert?.set?.theme).toBe('dark');
  });

  it('persiste notificationsEnabled en user_settings', async () => {
    await updateUserSettings(USER, { notificationsEnabled: false });
    const upsert = calls.find((c) => c.op === 'upsert' && c.table === 'user_settings');
    expect(upsert?.values?.notificationsEnabled).toBe(false);
  });

  it('el timezone va a users, no toca user_settings', async () => {
    await updateUserSettings(USER, { timezone: 'America/Santo_Domingo' });
    expect(calls.some((c) => c.op === 'upsert')).toBe(false);
    const upd = calls.find((c) => c.op === 'update' && c.table === 'users');
    expect(upd?.values?.timezone).toBe('America/Santo_Domingo');
  });

  it('combina varios campos de user_settings en un solo upsert', async () => {
    await updateUserSettings(USER, { dailyEnergyLimit: 80, theme: 'light' });
    const upserts = calls.filter((c) => c.op === 'upsert' && c.table === 'user_settings');
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.values?.dailyEnergyLimit).toBe(80);
    expect(upserts[0]?.values?.theme).toBe('light');
  });

  it('persiste weeklyReviewDay en user_settings (KIN-131)', async () => {
    await updateUserSettings(USER, { weeklyReviewDay: 'fri' });
    const upsert = calls.find((c) => c.op === 'upsert' && c.table === 'user_settings');
    expect(upsert?.values?.weeklyReviewDay).toBe('fri');
    expect(upsert?.set?.weeklyReviewDay).toBe('fri');
    // No debe arrastrar la columna a users: el día de revisión no es del cron.
    expect(calls.some((c) => c.op === 'update' && c.table === 'users')).toBe(false);
  });
});

describe('updateUserSettingsSchema (KIN-131)', () => {
  it('acepta un weeklyReviewDay válido', () => {
    const parsed = updateUserSettingsSchema.safeParse({ weeklyReviewDay: 'wed' });
    expect(parsed.success).toBe(true);
  });

  it('rechaza un día que no existe en el enum de la columna', () => {
    expect(updateUserSettingsSchema.safeParse({ weeklyReviewDay: 'domingo' }).success).toBe(false);
    expect(updateUserSettingsSchema.safeParse({ weeklyReviewDay: 'Sun' }).success).toBe(false);
  });

  it('sigue exigiendo al menos un campo conocido', () => {
    expect(updateUserSettingsSchema.safeParse({}).success).toBe(false);
    // Una clave desconocida se descarta, así que el payload queda vacío.
    expect(updateUserSettingsSchema.safeParse({ inventado: true }).success).toBe(false);
  });
});
