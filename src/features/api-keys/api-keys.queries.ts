import { db } from '@/shared/db';
import { api_keys } from '@/shared/db/schema';
import { and, eq } from 'drizzle-orm';

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
