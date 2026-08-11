import { NextRequest } from 'next/server';
import { postDecomposeRoute } from '@/features/insights/insights.routes';

export const POST = (req: NextRequest) => postDecomposeRoute(req);
