import { db } from '@/shared/db';
import { api_keys } from '@/shared/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function deleteApiKeysByName(userId: string, name: string) {
  await db
    .delete(api_keys)
    .where(and(eq(api_keys.userId, userId), eq(api_keys.name, name)));
}

export async function findRecentApiKeyByName(
  userId: string,
  name: string,
  withinSeconds: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinSeconds * 1000);
  const [row] = await db
    .select({ id: api_keys.id })
    .from(api_keys)
    .where(
      and(
        eq(api_keys.userId, userId),
        eq(api_keys.name, name),
        sql`${api_keys.createdAt} > ${cutoff.toISOString()}`,
      ),
    )
    .limit(1);
  return !!row;
}

export async function insertApiKey(values: {
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
}) {
  const [record] = await db.insert(api_keys).values(values).returning();
  return record!;
}

export async function findApiKeyByHash(keyHash: string) {
  const [record] = await db
    .select()
    .from(api_keys)
    .where(eq(api_keys.keyHash, keyHash));
  return record ?? null;
}

export async function touchApiKey(id: string) {
  await db
    .update(api_keys)
    .set({ lastUsedAt: new Date() })
    .where(eq(api_keys.id, id));
}

export async function selectApiKeysByUser(userId: string) {
  return db
    .select({
      id: api_keys.id,
      name: api_keys.name,
      keyPrefix: api_keys.keyPrefix,
      lastUsedAt: api_keys.lastUsedAt,
      createdAt: api_keys.createdAt,
    })
    .from(api_keys)
    .where(eq(api_keys.userId, userId));
}

export async function deleteApiKeyById(id: string, userId: string) {
  const result = await db
    .delete(api_keys)
    .where(and(eq(api_keys.id, id), eq(api_keys.userId, userId)))
    .returning({ id: api_keys.id });
  return result.length > 0;
}
