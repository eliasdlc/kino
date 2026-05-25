import { NextRequest } from 'next/server';
import { getSuggestRoute } from '@/features/insights/insights.routes';

export const GET = (req: NextRequest) => getSuggestRoute(req);
