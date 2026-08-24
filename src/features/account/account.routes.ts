import { NextResponse } from 'next/server';
import { route } from '@/shared/utils/route';
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  updateAccountSchema,
} from './account.schemas';
import {
  changePassword,
  deleteAccount,
  getAccountOverview,
  listActiveSessions,
  renameAccount,
  requestEmailChange,
  revokeOtherSessions,
  revokeSession,
} from './account.service';

/**
 * Todas las rutas de cuenta son `sessionOnly`: una clave API o un token del
 * MCP no puede cambiar credenciales, cerrar sesiones ni borrar la cuenta,
 * aunque sean del mismo usuario.
 */

/** Copia a la respuesta las cookies que Better Auth quiere fijar o borrar. */
function withAuthCookies(res: NextResponse, authHeaders: Headers): NextResponse {
  for (const cookie of authHeaders.getSetCookie()) {
    res.headers.append('set-cookie', cookie);
  }
  return res;
}

// GET /api/account
export const getAccountRoute = route()({ sessionOnly: true }, async ({ userId }) =>
  NextResponse.json(await getAccountOverview(userId)),
);

// PATCH /api/account
export const updateAccountRoute = route()(
  { sessionOnly: true, body: updateAccountSchema },
  async ({ userId, body }) => NextResponse.json(await renameAccount(userId, body.name)),
);

// POST /api/account/password
export const changePasswordRoute = route()(
  { sessionOnly: true, body: changePasswordSchema },
  async ({ body, request }) => {
    const authHeaders = await changePassword(request.headers, body);
    return withAuthCookies(NextResponse.json({ ok: true }), authHeaders);
  },
);

// POST /api/account/email
export const changeEmailRoute = route()(
  { sessionOnly: true, body: changeEmailSchema },
  async ({ body, request }) => {
    await requestEmailChange(request.headers, body.newEmail);
    return NextResponse.json({ ok: true }, { status: 202 });
  },
);

// GET /api/account/sessions
export const listSessionsRoute = route()({ sessionOnly: true }, async ({ userId, sessionId }) =>
  NextResponse.json(await listActiveSessions(userId, sessionId)),
);

// DELETE /api/account/sessions/[id]
export const revokeSessionRoute = route<{ id: string }>()(
  { sessionOnly: true },
  async ({ userId, sessionId, params }) => {
    await revokeSession(userId, params.id, sessionId);
    return new NextResponse(null, { status: 204 });
  },
);

// POST /api/account/sessions/revoke-others
export const revokeOtherSessionsRoute = route()({ sessionOnly: true }, async ({ userId, sessionId }) =>
  NextResponse.json({ revoked: await revokeOtherSessions(userId, sessionId) }),
);

// POST /api/account/delete
export const deleteAccountRoute = route()(
  { sessionOnly: true, body: deleteAccountSchema },
  async ({ userId, body, request }) => {
    const authHeaders = await deleteAccount({
      userId,
      confirmation: body.email,
      headers: request.headers,
    });
    return withAuthCookies(NextResponse.json({ ok: true }), authHeaders);
  },
);
