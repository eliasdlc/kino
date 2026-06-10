import { NextRequest } from 'next/server';
import { getUserSettingsRoute, updateUserSettingsRoute } from '@/features/settings/settings.routes';

export function GET(request: NextRequest) {
  return getUserSettingsRoute(request);
}

export function PATCH(request: NextRequest) {
  return updateUserSettingsRoute(request);
}
