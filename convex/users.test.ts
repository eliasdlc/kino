import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');

const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

describe('users.ensure', () => {
  it('sin identidad no crea nada y falla', async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.ensure, {})).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(0);
  });

  it('crea el documento una sola vez por identidad', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const first = await asAna.mutation(api.users.ensure, {});
    const second = await asAna.mutation(api.users.ensure, {});
    expect(second).toBe(first);
    const users = await t.run((ctx) => ctx.db.query('users').collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ clerkId: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' });
  });

  it('enlaza un usuario importado por su correo en vez de duplicarlo', async () => {
    const t = convexTest(schema, modules);
    const importedId = await t.run((ctx) =>
      ctx.db.insert('users', {
        pgId: 'pg-1',
        email: 'ana@usekino.dev',
        name: 'Ana de Postgres',
        onboardingCompleted: true,
        status: 'active',
        timezone: 'America/Santo_Domingo',
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const id = await t.withIdentity(ana).mutation(api.users.ensure, {});
    expect(id).toBe(importedId);
    const doc = await t.run((ctx) => ctx.db.get(importedId));
    expect(doc?.clerkId).toBe('user_ana');
    expect(doc?.onboardingCompleted).toBe(true);
  });

  it('current devuelve el documento de quien llama y rechaza al anónimo', async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(ana).mutation(api.users.ensure, {});
    expect((await t.withIdentity(ana).query(api.users.current, {})).email).toBe('ana@usekino.dev');
    await expect(t.query(api.users.current, {})).rejects.toThrow();
  });
});
