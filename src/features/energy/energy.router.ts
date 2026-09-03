import { implement, ORPCError } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { energyContract } from "./energy.contract";
import {
  applyWeeklyRitual,
  clearTaskBlock,
  getEnergyWindows,
  getWeeklyRitual,
  proposeDayBlocks,
  scheduleTaskBlock,
} from "./energy.blocks";
import {
  createTodayCheckin,
  getTodayAdvisor,
  getTodayCheckins,
  getTodayEnergyPlan,
  updatePredictionAccuracy,
} from "./energy.service";

const os = implement(energyContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

/**
 * Sin perfil de energía no hay ventanas que proponer. Es un 404 con código
 * propio y no un `NotFoundError`, porque la UI lo distingue de "no existe"
 * para ofrecer configurar el perfil.
 */
function noProfile(): never {
  throw new ORPCError("NO_PROFILE", {
    status: 404,
    message: "El usuario no tiene perfil de energía configurado todavía",
  });
}

export const energyRouter = os.router({
  checkins: os.checkins.handler(({ context }) => getTodayCheckins(context.userId)),

  createCheckin: os.createCheckin.handler(({ context, input }) =>
    createTodayCheckin(context.userId, input),
  ),

  updateAccuracy: os.updateAccuracy.handler(async ({ context, input }) => {
    const updated = await updatePredictionAccuracy(context.userId, input);
    if (!updated) throw new NotFoundError("No checkin found for this slot");
    return updated;
  }),

  advisor: os.advisor.handler(({ context }) => getTodayAdvisor(context.userId)),

  todayPlan: os.todayPlan.handler(({ context }) => getTodayEnergyPlan(context.userId)),

  windows: os.windows.handler(async ({ context }) => {
    const windows = await getEnergyWindows(context.userId);
    if (!windows) noProfile();
    return windows;
  }),

  blockProposal: os.blockProposal.handler(async ({ context, input }) => {
    const proposal = await proposeDayBlocks(context.userId, input.date, input.startHour);
    if (!proposal) noProfile();
    return proposal;
  }),

  scheduleBlock: os.scheduleBlock.handler(({ context, input }) =>
    scheduleTaskBlock(context.userId, input.taskId, input.date, input.hour),
  ),

  clearBlock: os.clearBlock.handler(({ context, input }) =>
    clearTaskBlock(context.userId, input.taskId),
  ),

  weeklyRitual: os.weeklyRitual.handler(({ context }) => getWeeklyRitual(context.userId)),

  applyWeeklyRitual: os.applyWeeklyRitual.handler(({ context, input }) =>
    applyWeeklyRitual(context.userId, input.assignments),
  ),
});
