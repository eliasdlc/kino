import { NextResponse } from 'next/server';
import { route } from '@/shared/utils/route';
import { updateUserSettingsSchema } from './settings.schemas';
import { getUserSettings, updateUserSettings } from './settings.service';

// GET/PATCH /api/settings
export const getUserSettingsRoute = route()({}, async ({ userId }) =>
  NextResponse.json(await getUserSettings(userId)),
);

export const updateUserSettingsRoute = route()(
  { body: updateUserSettingsSchema },
  async ({ userId, body }) => NextResponse.json(await updateUserSettings(userId, body)),
);
