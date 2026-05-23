import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createCheckinSchema } from './energy.schemas';
import { createTodayCheckin, getTodayCheckin, getTodayPlan } from './energy.service';

export async function createCheckinRoute(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
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
    const checkin = await createTodayCheckin(session.user.id, parsed.data);
    return NextResponse.json(checkin, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to save check-in' },
      { status: 500 },
    );
  }
}

export async function getTodayCheckinRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const checkin = await getTodayCheckin(session.user.id);
    return NextResponse.json(checkin);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch check-in' },
      { status: 500 },
    );
  }
}

export async function getTodayPlanRoute() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await getTodayPlan(session.user.id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to generate plan' },
      { status: 500 },
    );
  }
}
