import { implement } from "@orpc/server";
import {
  authenticate,
  requireSession,
  translateDomainErrors,
  type ApiContext,
} from "@/shared/api/procedures";
import { accountContract } from "./account.contract";
import {
  changePassword,
  deleteAccount,
  getAccountOverview,
  listActiveSessions,
  renameAccount,
  requestEmailChange,
  revokeOtherSessions,
  revokeSession,
} from "./account.service";

const os = implement(accountContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate)
  .use(requireSession);

/** Copia a la respuesta las cookies que Better Auth quiere fijar o borrar. */
function forwardAuthCookies(resHeaders: Headers | undefined, authHeaders: Headers) {
  for (const cookie of authHeaders.getSetCookie()) {
    resHeaders?.append("set-cookie", cookie);
  }
}

export const accountRouter = os.router({
  overview: os.overview.handler(({ context }) => getAccountOverview(context.userId)),

  rename: os.rename.handler(({ context, input }) => renameAccount(context.userId, input.name)),

  changePassword: os.changePassword.handler(async ({ context, input }) => {
    const authHeaders = await changePassword(context.request.headers, input);
    forwardAuthCookies(context.resHeaders, authHeaders);
    return { ok: true as const };
  }),

  changeEmail: os.changeEmail.handler(async ({ context, input }) => {
    await requestEmailChange(context.request.headers, input.newEmail);
    return { ok: true as const };
  }),

  sessions: os.sessions.handler(({ context }) =>
    listActiveSessions(context.userId, context.sessionId),
  ),

  revokeSession: os.revokeSession.handler(async ({ context, input }) => {
    await revokeSession(context.userId, input.id, context.sessionId);
  }),

  revokeOtherSessions: os.revokeOtherSessions.handler(async ({ context }) => ({
    revoked: await revokeOtherSessions(context.userId, context.sessionId),
  })),

  remove: os.remove.handler(async ({ context, input }) => {
    const authHeaders = await deleteAccount({
      userId: context.userId,
      confirmation: input.email,
      headers: context.request.headers,
    });
    forwardAuthCookies(context.resHeaders, authHeaders);
    return { ok: true as const };
  }),
});
