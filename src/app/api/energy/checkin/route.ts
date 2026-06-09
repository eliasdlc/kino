import { NextRequest } from 'next/server';
import {
  createCheckinRoute,
  getTodayCheckinsRoute,
  updateCheckinAccuracyRoute,
} from '@/features/energy/energy.routes';

export function POST(request: NextRequest) {
  return createCheckinRoute(request);
}

export function GET(request: NextRequest) {
  return getTodayCheckinsRoute(request);
}

export function PATCH(request: NextRequest) {
  return updateCheckinAccuracyRoute(request);
}
