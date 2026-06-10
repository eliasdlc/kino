import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import { updateUserSettingsSchema } from './settings.schemas';
import { getUserSettings, updateUserSettings } from './settings.service';

export async function getUserSettingsRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getUserSettings(ctx.userId);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' },
      { status: 500 },
    );
  }
}

export async function updateUserSettingsRoute(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateUserSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const settings = await updateUserSettings(ctx.userId, parsed.data);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update settings' },
      { status: 500 },
    );
  }
}
