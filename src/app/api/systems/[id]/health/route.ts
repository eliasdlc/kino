import { NextRequest } from 'next/server';
import { getSystemHealthRoute } from '@/features/systems/systems.routes';

export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getSystemHealthRoute(request, context);
}
