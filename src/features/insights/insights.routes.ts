import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
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

function handleError(e: unknown) {
  console.error('[insights]', e);
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed' }, { status: 500 });
}

function invalid(message: string) {
  return NextResponse.json({ code: 'VALIDATION_ERROR', message }, { status: 400 });
}

/** `null` cuando el cuerpo no es JSON o no es un objeto. */
async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getContextRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await getUserContext(ctx.userId));
  } catch (e) { return handleError(e); }
}

export async function getPatternsRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  try {
    const pattern = await getTopPattern(ctx.userId);
    return NextResponse.json(pattern ?? { pattern: null });
  } catch (e) { return handleError(e); }
}

export async function getEnergyDistributionRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  const days = parseInt(new URL(request.url).searchParams.get('days') ?? '7', 10);
  const safeDays = isNaN(days) || days < 1 || days > 90 ? 7 : days;
  try {
    return NextResponse.json(await getEnergyDistribution(ctx.userId, safeDays));
  } catch (e) { return handleError(e); }
}

export async function getSuggestRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  const rawLimit = parseInt(new URL(request.url).searchParams.get('limit') ?? '10', 10);
  const limit = isNaN(rawLimit) || rawLimit < 1 || rawLimit > 10 ? 10 : rawLimit;
  try {
    return NextResponse.json(await getSuggestedTasks(ctx.userId, limit));
  } catch (e) { return handleError(e); }
}

export async function postClassifyRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Invalid JSON' }, { status: 400 });
  }
  if (
    typeof body !== 'object' || body === null ||
    !('title' in body) || typeof (body as Record<string, unknown>).title !== 'string'
  ) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'title (string) required' }, { status: 400 });
  }
  const { title, description } = body as { title: string; description?: string };
  if (!title.trim()) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'title cannot be empty' }, { status: 400 });
  }
  try {
    return NextResponse.json(await classifyTask(ctx.userId, title, description));
  } catch (e) { return handleError(e); }
}

/**
 * POST /api/insights/estimate — energía y tiempo estimados desde el texto de
 * una tarea. Es el endpoint que faltaba para que `estimate_task` dejara de
 * llevar la regla dentro del paquete MCP (KIN-148 / BE-11).
 *
 * No toca la base: es una función pura sobre el título y la descripción, así
 * que no hay try/catch — no hay I/O que pueda fallar.
 */
export async function postEstimateRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody(request);
  if (!body) return invalid('Invalid JSON');

  const { title, description } = body;
  if (typeof title !== 'string' || !title.trim()) return invalid('title (string) required');

  return NextResponse.json(
    estimateTaskAttributes(title, typeof description === 'string' ? description : undefined),
  );
}

/**
 * POST /api/insights/decompose — la tarea, lo que ya está partido de ella y el
 * contrato de salida, en una sola llamada. Quien redacta las subtareas es el
 * modelo que llama al tool; la app decide qué información necesita para hacerlo
 * bien y cuáles son las reglas (KIN-148 / BE-11).
 */
export async function postDecomposeRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody(request);
  if (!body) return invalid('Invalid JSON');

  const { taskId, count } = body;
  // Se valida aquí para que un id mal formado sea un 400 y no el 500 que
  // devolvería Postgres al fallar el cast a uuid.
  if (typeof taskId !== 'string' || !UUID_PATTERN.test(taskId)) {
    return invalid('taskId (uuid) required');
  }
  if (count !== undefined && (typeof count !== 'number' || !Number.isFinite(count))) {
    return invalid('count must be a number');
  }

  try {
    const brief = await buildDecompositionBrief(ctx.userId, taskId, count);
    if (!brief) return NextResponse.json({ code: 'NOT_FOUND', message: 'Task not found' }, { status: 404 });
    return NextResponse.json(brief);
  } catch (e) { return handleError(e); }
}

export async function getStaleSystemsRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  const days = parseInt(new URL(request.url).searchParams.get('days') ?? '14', 10);
  const safeDays = isNaN(days) || days < 1 || days > 180 ? 14 : days;
  try {
    return NextResponse.json(await getStaleSystems(ctx.userId, safeDays));
  } catch (e) { return handleError(e); }
}
