import { endpoint, output } from "@/shared/api/contract";
import { KINO_READ } from "@/shared/lib/scopes";
import {
  classifyTaskSchema,
  decomposeSchema,
  energyDistributionQuerySchema,
  estimateTaskSchema,
  staleSystemsQuerySchema,
  suggestQuerySchema,
} from "./insights.schemas";
import type {
  buildDecompositionBrief,
  classifyTask,
  estimateTaskAttributes,
  getEnergyDistribution,
  getStaleSystems,
  getSuggestedTasks,
  getTopPattern,
  getUserContext,
} from "./insights.service";

type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

/**
 * Los tres POST de este slice no escriben nada: el body es el filtro de una
 * lectura, no una mutación. Sin `scope` el permiso saldría del verbo y les
 * exigiría `kino:write`, que sería mentir sobre lo que hacen.
 */
export const insightsContract = {
  context: endpoint
    .route({ method: "GET", path: "/insights/context" })
    .output(output<Returns<typeof getUserContext>>()),

  patterns: endpoint
    .route({ method: "GET", path: "/insights/patterns" })
    .output(output<Returns<typeof getTopPattern> | { pattern: null }>()),

  energyDistribution: endpoint
    .route({ method: "GET", path: "/insights/energy-distribution" })
    .input(energyDistributionQuerySchema)
    .output(output<Returns<typeof getEnergyDistribution>>()),

  suggest: endpoint
    .route({ method: "GET", path: "/insights/suggest" })
    .input(suggestQuerySchema)
    .output(output<Returns<typeof getSuggestedTasks>>()),

  staleSystems: endpoint
    .route({ method: "GET", path: "/insights/stale-systems" })
    .input(staleSystemsQuerySchema)
    .output(output<Returns<typeof getStaleSystems>>()),

  classify: endpoint
    .route({ method: "POST", path: "/insights/classify" })
    .meta({ scope: KINO_READ })
    .input(classifyTaskSchema)
    .output(output<Returns<typeof classifyTask>>()),

  estimate: endpoint
    .route({ method: "POST", path: "/insights/estimate" })
    .meta({ scope: KINO_READ })
    .input(estimateTaskSchema)
    .output(output<ReturnType<typeof estimateTaskAttributes>>()),

  decompose: endpoint
    .route({ method: "POST", path: "/insights/decompose" })
    .meta({ scope: KINO_READ })
    .input(decomposeSchema)
    .output(output<NonNullable<Returns<typeof buildDecompositionBrief>>>()),
};
