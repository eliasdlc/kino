import { NextRequest } from 'next/server';
import { getTodayPlanRoute } from '@/features/energy/energy.routes';

export function GET(request: NextRequest) {
  return getTodayPlanRoute(request);
}
