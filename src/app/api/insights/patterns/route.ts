import { NextRequest } from 'next/server';
import { getPatternsRoute } from '@/features/insights/insights.routes';

export const GET = (req: NextRequest) => getPatternsRoute(req);
