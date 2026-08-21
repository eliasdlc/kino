import { z } from 'zod';

export const apiKeyTtlSchema = z.enum(['d30', 'd90', 'y1', 'never']);

export type ApiKeyTtl = z.infer<typeof apiKeyTtlSchema>;

/**
 * Duraciones que se ofrecen al crear una clave, en días. `never` es null.
 *
 * El default es 90 días y no "nunca" a propósito: una `sk-kino-` viaja fuera
 * del navegador (config del MCP, historial de la shell, portapapeles) y es la
 * credencial que más debería caducar. Añadir una opción al enum obliga a darle
 * su duración aquí.
 */
export const API_KEY_TTL_DAYS: Record<ApiKeyTtl, number | null> = {
  d30: 30,
  d90: 90,
  y1: 365,
  never: null,
};

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  ttl: apiKeyTtlSchema.default('d90'),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
