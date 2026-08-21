import { beforeEach, describe, expect, it, vi } from 'vitest';

const findApiKeyByHash = vi.fn();
const touchApiKey = vi.fn<(id: string) => Promise<void>>(async () => {});

vi.mock('./api-keys.queries', () => ({
  findApiKeyByHash: (hash: string) => findApiKeyByHash(hash),
  touchApiKey: (id: string) => touchApiKey(id),
  insertApiKey: vi.fn(),
  selectApiKeysByUser: vi.fn(),
  deleteApiKeyById: vi.fn(),
  deleteApiKeysByName: vi.fn(),
  findRecentApiKeyByName: vi.fn(),
  revokeApiKeyById: vi.fn(),
}));

const { validateApiKey, resolveExpiry } = await import('./api-keys.service');

const TOKEN = 'sk-kino-' + 'a'.repeat(43);
const HOUR = 60 * 60 * 1000;

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    userId: 'user-1',
    lastUsedAt: new Date(Date.now() - 2 * HOUR),
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  findApiKeyByHash.mockReset();
  touchApiKey.mockClear();
});

describe('validateApiKey · ciclo de vida', () => {
  it('una clave sin caducidad sigue sirviendo: la migración no caduca las que ya existían', async () => {
    findApiKeyByHash.mockResolvedValue(record({ expiresAt: null }));
    await expect(validateApiKey(TOKEN)).resolves.toBe('user-1');
  });

  it('una clave con caducidad futura sirve', async () => {
    findApiKeyByHash.mockResolvedValue(record({ expiresAt: new Date(Date.now() + HOUR) }));
    await expect(validateApiKey(TOKEN)).resolves.toBe('user-1');
  });

  it('una clave caducada no sirve', async () => {
    findApiKeyByHash.mockResolvedValue(record({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(validateApiKey(TOKEN)).resolves.toBeNull();
  });

  it('una clave revocada no sirve, aunque no haya caducado', async () => {
    findApiKeyByHash.mockResolvedValue(
      record({ revokedAt: new Date(), expiresAt: new Date(Date.now() + HOUR) }),
    );
    await expect(validateApiKey(TOKEN)).resolves.toBeNull();
  });

  it('el rechazo de una caducada es indistinguible del de una clave inventada', async () => {
    findApiKeyByHash.mockResolvedValueOnce(record({ expiresAt: new Date(Date.now() - 1000) }));
    const caducada = await validateApiKey(TOKEN);
    findApiKeyByHash.mockResolvedValueOnce(null);
    const inventada = await validateApiKey(TOKEN);
    expect(caducada).toBe(inventada);
  });

  it('no consulta la base si el token no tiene el prefijo de Kino', async () => {
    await expect(validateApiKey('cualquier-otra-cosa')).resolves.toBeNull();
    expect(findApiKeyByHash).not.toHaveBeenCalled();
  });

  it('una clave rechazada no actualiza lastUsedAt', async () => {
    findApiKeyByHash.mockResolvedValue(record({ revokedAt: new Date() }));
    await validateApiKey(TOKEN);
    expect(touchApiKey).not.toHaveBeenCalled();
  });
});

describe('validateApiKey · escrituras de lastUsedAt', () => {
  it('no escribe si ya se usó hace menos de una hora', async () => {
    findApiKeyByHash.mockResolvedValue(record({ lastUsedAt: new Date(Date.now() - 60_000) }));
    await validateApiKey(TOKEN);
    expect(touchApiKey).not.toHaveBeenCalled();
  });

  it('escribe si el último uso es de hace más de una hora', async () => {
    findApiKeyByHash.mockResolvedValue(record({ lastUsedAt: new Date(Date.now() - 2 * HOUR) }));
    await validateApiKey(TOKEN);
    expect(touchApiKey).toHaveBeenCalledWith('key-1');
  });

  it('escribe la primera vez que se usa', async () => {
    findApiKeyByHash.mockResolvedValue(record({ lastUsedAt: null }));
    await validateApiKey(TOKEN);
    expect(touchApiKey).toHaveBeenCalledWith('key-1');
  });

  it('diez llamadas seguidas producen una sola escritura', async () => {
    let lastUsedAt: Date | null = null;
    findApiKeyByHash.mockImplementation(async () => record({ lastUsedAt }));
    touchApiKey.mockImplementation(async () => {
      lastUsedAt = new Date();
    });
    for (let i = 0; i < 10; i++) await validateApiKey(TOKEN);
    expect(touchApiKey).toHaveBeenCalledTimes(1);
  });
});

describe('resolveExpiry', () => {
  const now = new Date('2026-08-21T12:00:00.000Z');

  it('never no caduca', () => {
    expect(resolveExpiry('never', now)).toBeNull();
  });

  it('cada duración cae en su día', () => {
    expect(resolveExpiry('d30', now)?.toISOString()).toBe('2026-09-20T12:00:00.000Z');
    expect(resolveExpiry('d90', now)?.toISOString()).toBe('2026-11-19T12:00:00.000Z');
    expect(resolveExpiry('y1', now)?.toISOString()).toBe('2027-08-21T12:00:00.000Z');
  });
});
