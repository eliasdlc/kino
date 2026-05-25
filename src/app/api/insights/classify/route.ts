import { NextRequest } from 'next/server';
import { postClassifyRoute } from '@/features/insights/insights.routes';

export const POST = (req: NextRequest) => postClassifyRoute(req);
