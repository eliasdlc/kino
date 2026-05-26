import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { generateApiKeyReplacing } from '@/features/api-keys/api-keys.service';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
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
    const next = encodeURIComponent(`/api/connect/cli?port=${port}`);
    return NextResponse.redirect(`${origin}/login?next=${next}`);
  }

  const result = await generateApiKeyReplacing(session.user.id, 'Claude Code (CLI)');

  if ('rateLimited' in result) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' },
      { status: 429 },
    );
  }

  return NextResponse.redirect(`http://localhost:${port}/callback?token=${result.token}`);
}
