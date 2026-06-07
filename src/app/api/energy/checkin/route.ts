import { NextRequest } from 'next/server';
import { createCheckinRoute, getTodayCheckinRoute } from '@/features/energy/energy.routes';

export function POST(request: NextRequest) {
  return createCheckinRoute(request);
}

export function GET(request: NextRequest) {
  return getTodayCheckinRoute(request);
}
