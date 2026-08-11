import { NextRequest } from 'next/server';
import { getWeeklyRitualRoute, applyWeeklyRitualRoute } from '@/features/energy/energy.routes';

/** Estado del ritual: vencidas y dónde caben en la semana. */
export function GET(request: NextRequest) {
  return getWeeklyRitualRoute(request);
}

/** Aplica el reparto confirmado. */
export function POST(request: NextRequest) {
  return applyWeeklyRitualRoute(request);
}
