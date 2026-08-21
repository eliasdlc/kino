import { NextResponse } from 'next/server';
import { route } from '@/shared/utils/route';
import { KINO_READ } from '@/shared/lib/scopes';
// Los tres POST de este slice no escriben nada: el body es el filtro de una
// lectura, no una mutación. Sin este override el wrapper les exigiría
// `kino:write` por el verbo.
import { NotFoundError } from '@/shared/utils/error';
import {
  classifyTaskSchema,
  decomposeSchema,
  energyDistributionQuerySchema,
  estimateTaskSchema,
  staleSystemsQuerySchema,
  suggestQuerySchema,
} from './insights.schemas';
import {
  getUserContext,
  getTopPattern,
  getEnergyDistribution,
  getSuggestedTasks,
  classifyTask,
  estimateTaskAttributes,
  buildDecompositionBrief,
  getStaleSystems,
} from './insights.service';

export const getContextRoute = route()({}, async ({ userId }) =>
  NextResponse.json(await getUserContext(userId)),
);

export const getPatternsRoute = route()({}, async ({ userId }) => {
  const pattern = await getTopPattern(userId);
  return NextResponse.json(pattern ?? { pattern: null });
});

export const getEnergyDistributionRoute = route()(
  { query: energyDistributionQuerySchema },
  async ({ userId, query }) => NextResponse.json(await getEnergyDistribution(userId, query.days)),
);

export const getSuggestRoute = route()(
  { query: suggestQuerySchema },
  async ({ userId, query }) => NextResponse.json(await getSuggestedTasks(userId, query.limit)),
);

export const postClassifyRoute = route()(
  { body: classifyTaskSchema, requiredScope: KINO_READ },
  async ({ userId, body }) =>
    NextResponse.json(await classifyTask(userId, body.title, body.description)),
);

/**
 * POST /api/insights/estimate: energía y tiempo estimados desde el texto de
 * una tarea. Es el endpoint que faltaba para que `estimate_task` dejara de
 * llevar la regla dentro del paquete MCP (KIN-148 / BE-11).
 *
 * No toca la base: es una función pura sobre el título y la descripción.
 */
export const postEstimateRoute = route()(
  { body: estimateTaskSchema, requiredScope: KINO_READ },
  async ({ body }) =>
    NextResponse.json(estimateTaskAttributes(body.title, body.description)),
);

/**
 * POST /api/insights/decompose: la tarea, lo que ya está partido de ella y el
 * contrato de salida, en una sola llamada. Quien redacta las subtareas es el
 * modelo que llama al tool; la app decide qué información necesita para hacerlo
 * bien y cuáles son las reglas (KIN-148 / BE-11).
 */
export const postDecomposeRoute = route()(
  { body: decomposeSchema, requiredScope: KINO_READ },
  async ({ userId, body }) => {
    const brief = await buildDecompositionBrief(userId, body.taskId, body.count);
    if (!brief) throw new NotFoundError('Task not found');
    return NextResponse.json(brief);
  },
);

export const getStaleSystemsRoute = route()(
  { query: staleSystemsQuerySchema },
  async ({ userId, query }) => NextResponse.json(await getStaleSystems(userId, query.days)),
);
