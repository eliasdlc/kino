import { implement } from "@orpc/server";
import {
  authenticate,
  requireSession,
  translateDomainErrors,
  type ApiContext,
} from "@/shared/api/procedures";
import { getServerSession } from "@/shared/utils/session";
import { accountContract } from "./account.contract";
import { deleteAccount, getAccountOverview } from "./account.service";

const os = implement(accountContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate)
  .use(requireSession);

export const accountRouter = os.router({
  overview: os.overview.handler(({ context }) => getAccountOverview(context.userId)),

  remove: os.remove.handler(async ({ context, input }) => {
    // `requireSession` ya garantizó que hay sesión de navegador, y esa sesión
    // es de Clerk: de ahí sale la identidad que hay que borrar allí.
    const session = await getServerSession();
    await deleteAccount({
      userId: context.userId,
      clerkId: session!.clerkId,
      confirmation: input.email,
    });
    return { ok: true as const };
  }),
});
