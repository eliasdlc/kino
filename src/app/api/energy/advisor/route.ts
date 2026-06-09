import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTodayAdvisor } from '@/features/energy/energy.service';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json(null, { status: 401 });

  const advisor = await getTodayAdvisor(session.user.id);
  return NextResponse.json(advisor);
}
