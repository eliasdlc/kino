import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * La mitad de servidor del nonce del CLI (KIN-162).
 *
 * El CLI genera el `state` y lo comprueba al recibir el callback, pero eso sólo
 * sirve si esta ruta lo devuelve intacto — y si un flujo sin nonce no llega a
 * emitir una API key. Las dos cosas se afirman aquí, porque el CLI por sí solo
 * no puede probarlas.
 *
 * La sesión y la emisión de la key se mockean: lo que se prueba es el manejo del
 * nonce y hacia dónde apunta el redirect, no cómo se firma una credencial.
 */

const generateApiKeyReplacing = vi.fn(async () => ({ token: 'sk-kino-emitida' }));
const getServerSession = vi.fn(async () => ({ user: { id: 'u-1' } }));

vi.mock('@/features/api-keys/api-keys.service', () => ({
  generateApiKeyReplacing: (...args: unknown[]) => generateApiKeyReplacing(...(args as [])),
}));
vi.mock('@/shared/utils/session', () => ({
  getServerSession: () => getServerSession(),
}));

const { GET } = await import('./route');

const STATE = 'HsQ2mF7kx9Lb0aZpV3nT8wYc1RdG5jEu4MoI6sN7qKA';

function connect(query: string) {
  return GET(new NextRequest(`http://localhost/api/connect/cli${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-1' } });
});

describe('sin un nonce válido no se emite nada', () => {
  const bad = {
    'sin state': '?port=51234',
    'state vacío': '?port=51234&state=',
    'state demasiado corto': '?port=51234&state=abc',
    'state con caracteres fuera de base64url': '?port=51234&state=abc/def+ghi=jkl.mno',
  };

  for (const [name, query] of Object.entries(bad)) {
    it(name, async () => {
      const res = await connect(query);
      expect(res.status).toBe(400);
      // Lo que de verdad importa: no llegó a existir una API key.
      expect(generateApiKeyReplacing).not.toHaveBeenCalled();
    });
  }

  it('sigue rechazando un puerto inválido antes que nada', async () => {
    expect((await connect(`?port=80&state=${STATE}`)).status).toBe(400);
    expect(generateApiKeyReplacing).not.toHaveBeenCalled();
  });
});

describe('con nonce válido', () => {
  it('devuelve el token y el state al callback de loopback', async () => {
    const res = await connect(`?port=51234&state=${STATE}`);
    const location = new URL(res.headers.get('location')!);

    expect(res.status).toBe(307);
    expect(location.origin).toBe('http://localhost:51234');
    expect(location.pathname).toBe('/callback');
    expect(location.searchParams.get('token')).toBe('sk-kino-emitida');
    expect(location.searchParams.get('state')).toBe(STATE);
  });

  it('el nonce sobrevive el desvío al login cuando no hay sesión', async () => {
    getServerSession.mockResolvedValue(null as never);

    const res = await connect(`?port=51234&state=${STATE}`);
    const location = new URL(res.headers.get('location')!);
    const next = new URL(location.searchParams.get('next')!, 'http://localhost');

    expect(location.pathname).toBe('/login');
    expect(next.searchParams.get('state')).toBe(STATE);
    expect(next.searchParams.get('port')).toBe('51234');
    expect(generateApiKeyReplacing).not.toHaveBeenCalled();
  });
});
