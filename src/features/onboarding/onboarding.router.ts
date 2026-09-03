import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { onboardingContract } from "./onboarding.contract";
import { getEnergyProfile } from "./onboarding.queries";
import { completeOnboarding } from "./onboarding.service";

const os = implement(onboardingContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const onboardingRouter = os.router({
  status: os.status.handler(async ({ context }) => ({
    completed: !!(await getEnergyProfile(context.userId)),
  })),

  complete: os.complete.handler(async ({ context, input }) => {
    await completeOnboarding(context.userId, input);
    return { ok: true as const };
  }),
});
