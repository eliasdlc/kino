import { createHash, randomBytes } from 'crypto';
import {
  insertApiKey,
  findApiKeyByHash,
  touchApiKey,
  selectApiKeysByUser,
  deleteApiKeyById,
  deleteApiKeysByName,
  findRecentApiKeyByName,
  revokeApiKeyById,
} from './api-keys.queries';
import { API_KEY_TTL_DAYS, type ApiKeyTtl } from './api-keys.schemas';

/**
 * Cada cuánto se refresca `lastUsedAt`. Ajustes sólo muestra la fecha, así que
 * escribir en cada request es una escritura por llamada para un dato que no
 * cambia de aspecto. Una hora deja margen por si algún día se muestra con más
 * detalle, y quita el 99% de las escrituras del camino crítico del MCP.
 */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Fecha de caducidad para una duración elegida al crear. `never` da null. */
export function resolveExpiry(ttl: ApiKeyTtl, now = new Date()): Date | null {
  const days = API_KEY_TTL_DAYS[ttl];
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function generateApiKeyReplacing(
  userId: string,
  name: string,
  ttl: ApiKeyTtl = 'd90',
): Promise<{ token: string } | { rateLimited: true }> {
  const tooSoon = await findRecentApiKeyByName(userId, name, 10);
  if (tooSoon) return { rateLimited: true };
  await deleteApiKeysByName(userId, name);
  return generateApiKey(userId, name, ttl);
}

export async function generateApiKey(userId: string, name: string, ttl: ApiKeyTtl = 'd90') {
  const raw = randomBytes(32).toString('base64url');
  const token = `sk-kino-${raw}`;
  const keyHash = hashToken(token);
  const keyPrefix = token.slice(0, 14);

  const record = await insertApiKey({
    userId,
    name,
    keyHash,
    keyPrefix,
    expiresAt: resolveExpiry(ttl),
  });
  return { token, record };
}

/**
 * Devuelve el dueño de la clave, o null si no sirve.
 *
 * Revocada y caducada devuelven exactamente lo mismo que una clave inventada:
 * quien prueba tokens no debe poder distinguir "no existe" de "existió y
 * caducó".
 */
export async function validateApiKey(rawToken: string): Promise<string | null> {
  if (!rawToken.startsWith('sk-kino-')) return null;
  const keyHash = hashToken(rawToken);
  const record = await findApiKeyByHash(keyHash);
  if (!record) return null;

  const now = Date.now();
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() <= now) return null;

  if (!record.lastUsedAt || now - record.lastUsedAt.getTime() >= TOUCH_INTERVAL_MS) {
    await touchApiKey(record.id);
  }
  return record.userId;
}

export async function listApiKeys(userId: string) {
  return selectApiKeysByUser(userId);
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  return revokeApiKeyById(keyId, userId);
}

export async function deleteApiKey(userId: string, keyId: string): Promise<boolean> {
  return deleteApiKeyById(keyId, userId);
}
