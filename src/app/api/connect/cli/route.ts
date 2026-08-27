import { NextRequest, NextResponse } from 'next/server';
import { generateApiKeyReplacing } from '@/features/api-keys/api-keys.service';
import { getServerSession } from '@/shared/utils/session';

/**
 * Emparejamiento del CLI: el navegador llega con sesión, la app emite una API key
 * y la devuelve al servidor efímero que `kino-mcp setup` levantó en loopback.
 *
 * Session-only a propósito (KIN-144): arranca desde el navegador y emite una API
 * key. Aceptar Bearer sería escalada de privilegio.
 *
 * El `state` lo genera el CLI y esta ruta lo devuelve intacto (KIN-162). Es la
 * otra mitad del nonce: sin él, una página que acierte el puerto efímero podría
 * llamar al callback con su propio token y dejar el agente escribiendo en la
 * cuenta de otro. Aquí no se valida contra nada porque no hay nada contra qué
 * validarlo — quien lo comprueba es el CLI, que es quien lo creó.
 */

/** Un nonce con la forma que produce `randomBytes(32).toString('base64url')`. */
const STATE = /^[A-Za-z0-9_-]{16,128}$/;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const portStr = searchParams.get('port');
  const port = parseInt(portStr ?? '', 10);
  const state = searchParams.get('state');

  if (!portStr || isNaN(port) || port < 1024 || port > 65535) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Valid port (1024–65535) required' },
      { status: 400 },
    );
  }

  // Se exige, no se rellena: un flujo sin nonce es justo el que hay que rechazar.
  // La forma se valida antes de devolverlo para que el parámetro no pueda traer
  // nada raro al construir el redirect.
  if (!state || !STATE.test(state)) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Valid state required. Update the Kino CLI: npx -y @kino-app/mcp setup' },
      { status: 400 },
    );
  }

  const session = await getServerSession();

  if (!session) {
    // El login vuelve aquí, así que el nonce tiene que sobrevivir la ida y vuelta.
    const back = new URL('/api/connect/cli', origin);
    back.searchParams.set('port', String(port));
    back.searchParams.set('state', state);

    const login = new URL('/login', origin);
    login.searchParams.set('next', `${back.pathname}${back.search}`);
    return NextResponse.redirect(login);
  }

  const result = await generateApiKeyReplacing(session.user.id, 'Claude Code (CLI)');

  if ('rateLimited' in result) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' },
      { status: 429 },
    );
  }

  const callback = new URL(`http://localhost:${port}/callback`);
  callback.searchParams.set('token', result.token);
  callback.searchParams.set('state', state);
  return NextResponse.redirect(callback);
}
