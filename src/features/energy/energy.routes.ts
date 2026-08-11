import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import { AppError } from '@/shared/utils/error';
import {
  createCheckinSchema,
  updateCheckinAccuracySchema,
  scheduleBlockSchema,
  blockProposalQuerySchema,
  applyRitualSchema,
} from './energy.schemas';
import {
  createTodayCheckin,
  getTodayCheckins,
  getTodayEnergyPlan,
  updatePredictionAccuracy,
} from './energy.service';
import {
  getEnergyWindows,
  proposeDayBlocks,
  scheduleTaskBlock,
  clearTaskBlock,
  getWeeklyRitual,
  applyWeeklyRitual,
} from './energy.blocks';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 422,
};

/** Traduce los errores de dominio a HTTP sin filtrar detalles internos. */
function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: STATUS_BY_CODE[error.code] ?? 400 },
    );
  }
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: fallback }, { status: 500 });
}

export async function createCheckinRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const checkin = await createTodayCheckin(ctx.userId, parsed.data);
    return NextResponse.json(checkin, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to save check-in' },
      { status: 500 },
    );
  }
}

export async function getTodayCheckinsRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const checkins = await getTodayCheckins(ctx.userId);
    return NextResponse.json(checkins);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch check-ins' },
      { status: 500 },
    );
  }
}

export async function updateCheckinAccuracyRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateCheckinAccuracySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await updatePredictionAccuracy(ctx.userId, parsed.data);
    if (!updated) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'No checkin found for this slot' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update accuracy' },
      { status: 500 },
    );
  }
}

export async function getTodayPlanRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await getTodayEnergyPlan(ctx.userId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to generate plan' },
      { status: 500 },
    );
  }
}

// ── Time-blocking (Fase 4.3) ───────────────────────────────────────────────

const NO_PROFILE = {
  code: 'NO_PROFILE',
  message: 'El usuario no tiene perfil de energía configurado todavía',
} as const;

export async function getEnergyWindowsRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const windows = await getEnergyWindows(ctx.userId);
    if (!windows) return NextResponse.json(NO_PROFILE, { status: 404 });
    return NextResponse.json(windows);
  } catch (error) {
    return errorResponse(error, 'Failed to read energy windows');
  }
}

export async function getBlockProposalRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = blockProposalQuerySchema.safeParse({
    date: url.searchParams.get('date') ?? undefined,
    startHour: url.searchParams.get('startHour') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const proposal = await proposeDayBlocks(ctx.userId, parsed.data.date, parsed.data.startHour);
    if (!proposal) return NextResponse.json(NO_PROFILE, { status: 404 });
    return NextResponse.json(proposal);
  } catch (error) {
    return errorResponse(error, 'Failed to build block proposal');
  }
}

export async function scheduleBlockRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = scheduleBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { taskId, date, hour } = parsed.data;
    const block = await scheduleTaskBlock(ctx.userId, taskId, date, hour);
    return NextResponse.json(block);
  } catch (error) {
    return errorResponse(error, 'Failed to schedule block');
  }
}

export async function clearBlockRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const taskId = new URL(request.url).searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Falta el parámetro taskId' },
      { status: 400 },
    );
  }

  try {
    const task = await clearTaskBlock(ctx.userId, taskId);
    return NextResponse.json(task);
  } catch (error) {
    return errorResponse(error, 'Failed to clear block');
  }
}

// ── Ritual de revisión semanal (Fase 4.4) ──────────────────────────────────

export async function getWeeklyRitualRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ritual = await getWeeklyRitual(ctx.userId);
    return NextResponse.json(ritual);
  } catch (error) {
    return errorResponse(error, 'Failed to build weekly ritual');
  }
}

export async function applyWeeklyRitualRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = applyRitualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await applyWeeklyRitual(ctx.userId, parsed.data.assignments);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, 'Failed to apply weekly ritual');
  }
}
