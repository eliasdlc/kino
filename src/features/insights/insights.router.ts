import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { insightsContract } from "./insights.contract";
import {
  buildDecompositionBrief,
  classifyTask,
  estimateTaskAttributes,
  getEnergyDistribution,
  getStaleSystems,
  getSuggestedTasks,
  getTopPattern,
  getUserContext,
} from "./insights.service";

const os = implement(insightsContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const insightsRouter = os.router({
  context: os.context.handler(({ context }) => getUserContext(context.userId)),

  patterns: os.patterns.handler(async ({ context }) => {
    const pattern = await getTopPattern(context.userId);
    return pattern ?? { pattern: null };
  }),

  energyDistribution: os.energyDistribution.handler(({ context, input }) =>
    getEnergyDistribution(context.userId, input.days),
  ),

  suggest: os.suggest.handler(({ context, input }) =>
    getSuggestedTasks(context.userId, input.limit),
  ),

  staleSystems: os.staleSystems.handler(({ context, input }) =>
    getStaleSystems(context.userId, input.days),
  ),

  classify: os.classify.handler(({ context, input }) =>
    classifyTask(context.userId, input.title, input.description),
  ),

  // No toca la base: es una función pura sobre el título y la descripción.
  estimate: os.estimate.handler(({ input }) =>
    estimateTaskAttributes(input.title, input.description),
  ),

  decompose: os.decompose.handler(async ({ context, input }) => {
    const brief = await buildDecompositionBrief(context.userId, input.taskId, input.count);
    if (!brief) throw new NotFoundError("Task not found");
    return brief;
  }),
});
