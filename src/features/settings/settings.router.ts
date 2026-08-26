import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { settingsContract } from "./settings.contract";
import { getUserSettings, updateUserSettings } from "./settings.service";

const os = implement(settingsContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const settingsRouter = os.router({
  get: os.get.handler(({ context }) => getUserSettings(context.userId)),
  update: os.update.handler(({ context, input }) => updateUserSettings(context.userId, input)),
});
