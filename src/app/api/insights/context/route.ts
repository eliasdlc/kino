import { NextRequest } from 'next/server';
import { getContextRoute } from '@/features/insights/insights.routes';

export const GET = (req: NextRequest) => getContextRoute(req);
