import { NextRequest } from 'next/server';
import { getEnergyWindowsRoute } from '@/features/energy/energy.routes';

export function GET(request: NextRequest) {
  return getEnergyWindowsRoute(request);
}
