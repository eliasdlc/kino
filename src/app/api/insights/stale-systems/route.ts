import { NextRequest } from 'next/server';
import { getStaleSystemsRoute } from '@/features/insights/insights.routes';

export const GET = (req: NextRequest) => getStaleSystemsRoute(req);
