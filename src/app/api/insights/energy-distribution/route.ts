import { NextRequest } from 'next/server';
import { getEnergyDistributionRoute } from '@/features/insights/insights.routes';

export const GET = (req: NextRequest) => getEnergyDistributionRoute(req);
