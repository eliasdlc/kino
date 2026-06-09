import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import { createCheckinSchema, updateCheckinAccuracySchema } from './energy.schemas';
import {
  createTodayCheckin,
  getTodayCheckins,
  getTodayEnergyPlan,
  updatePredictionAccuracy,
} from './energy.service';

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
