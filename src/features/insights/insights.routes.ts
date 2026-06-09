import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import {
  getUserContext,
  getTopPattern,
  getEnergyDistribution,
  getSuggestedTasks,
  classifyTask,
  getStaleSystems,
} from './insights.service';

function handleError(e: unknown) {
  console.error('[insights]', e);
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed' }, { status: 500 });
}

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

export async function getStaleSystemsRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  const days = parseInt(new URL(request.url).searchParams.get('days') ?? '14', 10);
  const safeDays = isNaN(days) || days < 1 || days > 180 ? 14 : days;
  try {
    return NextResponse.json(await getStaleSystems(ctx.userId, safeDays));
  } catch (e) { return handleError(e); }
}
