import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import { createCheckinSchema } from './energy.schemas';
import { createTodayCheckin, getTodayCheckin, getTodayEnergyPlan } from './energy.service';

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

export async function getTodayCheckinRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const checkin = await getTodayCheckin(ctx.userId);
    return NextResponse.json(checkin);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch check-in' },
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
