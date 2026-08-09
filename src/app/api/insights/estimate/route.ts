import { NextRequest } from 'next/server';
import { postEstimateRoute } from '@/features/insights/insights.routes';

export const POST = (req: NextRequest) => postEstimateRoute(req);
