import { implement } from "@orpc/server";
import {
  authenticate,
  requireSession,
  translateDomainErrors,
  type ApiContext,
} from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { apiKeysContract } from "./api-keys.contract";
import { deleteApiKey, generateApiKey, listApiKeys, revokeApiKey } from "./api-keys.service";

const os = implement(apiKeysContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate)
  .use(requireSession);

export const apiKeysRouter = os.router({
  list: os.list.handler(({ context }) => listApiKeys(context.userId)),

  create: os.create.handler(async ({ context, input }) => {
    const { token, record } = await generateApiKey(context.userId, input.name, input.ttl);
    return { token, ...record };
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    const deleted = await deleteApiKey(context.userId, input.id);
    if (!deleted) throw new NotFoundError("API key not found");
  }),

  revoke: os.revoke.handler(async ({ context, input }) => {
    const revoked = await revokeApiKey(context.userId, input.id);
    if (!revoked) throw new NotFoundError("API key not found");
  }),
});
