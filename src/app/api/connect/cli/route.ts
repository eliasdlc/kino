import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { generateApiKey } from '@/features/api-keys/api-keys.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const portStr = searchParams.get('port');
  const port = parseInt(portStr ?? '', 10);

  if (!portStr || isNaN(port) || port < 1024 || port > 65535) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Valid port (1024–65535) required' },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect(`/login?next=/api/connect/cli?port=${port}`);
  }

  const { token } = await generateApiKey(session.user.id, 'Claude Code (CLI)');

  redirect(`http://localhost:${port}/callback?token=${token}`);
}
