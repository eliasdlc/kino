import { NextRequest } from 'next/server';
import { getTimeLogSummaryRoute } from '@/features/tasks/tasks.routes';

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getTimeLogSummaryRoute(request, context);
}
