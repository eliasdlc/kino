import { createHash, randomBytes } from 'crypto';
import {
  insertApiKey,
  findApiKeyByHash,
  touchApiKey,
  selectApiKeysByUser,
  deleteApiKeyById,
} from './api-keys.queries';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function generateApiKey(userId: string, name: string) {
  const raw = randomBytes(32).toString('base64url');
  const token = `sk-kino-${raw}`;
  const keyHash = hashToken(token);
  const keyPrefix = token.slice(0, 14);

  const record = await insertApiKey({ userId, name, keyHash, keyPrefix });
  return { token, record };
}

export async function validateApiKey(rawToken: string): Promise<string | null> {
  if (!rawToken.startsWith('sk-kino-')) return null;
  const keyHash = hashToken(rawToken);
  const record = await findApiKeyByHash(keyHash);
  if (!record) return null;
  await touchApiKey(record.id);
  return record.userId;
}

export async function listApiKeys(userId: string) {
  return selectApiKeysByUser(userId);
}

export async function deleteApiKey(userId: string, keyId: string): Promise<boolean> {
  return deleteApiKeyById(keyId, userId);
}
