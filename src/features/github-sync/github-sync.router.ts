import { implement, ORPCError } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { githubContract } from "./github-sync.contract";
import { isOAuthConfigured, GithubOAuthNotConfigured } from "./github-sync.oauth";
import {
  disconnectGithub,
  getConnectionStatus,
  linkRepo,
  syncSystem,
  unlinkRepo,
} from "./github-sync.service";
import { GithubApiError } from "./github-sync.types";

/**
 * Traduce los errores de GitHub a algo que la UI pueda mostrar. Un 401 de
 * GitHub sale como 409 y no como 500: no es que la app se haya roto, es que hay
 * que reconectar, y el cliente necesita distinguirlo para ofrecer el botón
 * correcto.
 */
const translateGithubErrors = implement(githubContract)
  .$context<ApiContext>()
  .middleware(async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof GithubApiError) {
        throw new ORPCError(error.unauthorized ? "GITHUB_UNAUTHORIZED" : "GITHUB_ERROR", {
          status: error.unauthorized ? 409 : 502,
          message: error.message,
        });
      }
      if (error instanceof GithubOAuthNotConfigured) {
        throw new ORPCError("GITHUB_NOT_CONFIGURED", { status: 501, message: error.message });
      }
      throw error;
    }
  });

const os = implement(githubContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(translateGithubErrors)
  .use(authenticate);

export const githubRouter = os.router({
  status: os.status.handler(async ({ context }) => ({
    ...(await getConnectionStatus(context.userId)),
    configured: isOAuthConfigured(),
  })),

  disconnect: os.disconnect.handler(async ({ context }) => {
    await disconnectGithub(context.userId);
  }),

  linkRepo: os.linkRepo.handler(({ context, input }) => {
    const { id, ...repo } = input;
    return linkRepo(id, context.userId, repo);
  }),

  unlinkRepo: os.unlinkRepo.handler(async ({ context, input }) => {
    await unlinkRepo(input.id, context.userId);
  }),

  sync: os.sync.handler(({ context, input }) => syncSystem(input.id, context.userId)),
});
