import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import { getTodayAdvisor } from '@/features/energy/energy.service';

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const advisor = await getTodayAdvisor(authContext.userId);
  return NextResponse.json(advisor);
}
