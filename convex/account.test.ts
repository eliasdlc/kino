/**
 * Qué se prueba: que borrar la cuenta pide el correo de la cuenta, el mismo
 * que el diálogo de Ajustes hace escribir para confirmar, y que con otro no
 * toca ni Clerk ni los datos. Clerk se sustituye: lo que importa es si se le
 * llama y con qué identidad.
 */
import { convexTest } from 'convex-test';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }));
vi.mock('@clerk/backend', () => ({ createClerkClient: () => ({ users: { deleteUser } }) }));
const modules = import.meta.glob('./**/*.*s');

afterEach(() => { vi.clearAllMocks(); });

async function sembrar() {
  const t = convexTest(schema, modules);
  const ana = t.withIdentity({ subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' });
  const userId = await ana.mutation(api.users.ensure, {});
  return { t, ana, userId };
}

it('con el correo de la cuenta borra la identidad en Clerk y los datos', async () => {
  const { t, ana, userId } = await sembrar();
  const clerkId = (await t.run((ctx) => ctx.db.get(userId)))!.clerkId;

  // Como lo escribe una persona: con mayúsculas y un espacio de más.
  await ana.action(api.account.remove, { email: ' Ana@usekino.dev ' });

  expect(deleteUser).toHaveBeenCalledWith(clerkId);
  expect(await t.run((ctx) => ctx.db.get(userId))).toBeNull();
});

it('con otro correo falla sin tocar Clerk ni los datos', async () => {
  const { t, ana, userId } = await sembrar();

  await expect(ana.action(api.account.remove, { email: 'otra@usekino.dev' })).rejects.toThrow();

  expect(deleteUser).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.get(userId))).not.toBeNull();
});
