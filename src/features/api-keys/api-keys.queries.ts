import { db } from '@/shared/db';
import { apiKeys } from '@/shared/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function deleteApiKeysByName(userId: string, name: string) {
  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.name, name)));
}

export async function findRecentApiKeyByName(
  userId: string,
  name: string,
  withinSeconds: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinSeconds * 1000);
  const [row] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.userId, userId),
        eq(apiKeys.name, name),
        sql`${apiKeys.createdAt} > ${cutoff.toISOString()}`,
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
  const [record] = await db.insert(apiKeys).values(values).returning();
  return record!;
}

export async function findApiKeyByHash(keyHash: string) {
  const [record] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash));
  return record ?? null;
}

export async function touchApiKey(id: string) {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id));
}

export async function selectApiKeysByUser(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}

export async function deleteApiKeyById(id: string, userId: string) {
  const result = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  return result.length > 0;
}
