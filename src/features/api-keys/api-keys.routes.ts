import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createApiKeySchema } from './api-keys.schemas';
import { generateApiKey, listApiKeys, deleteApiKey } from './api-keys.service';

// Session-only a propósito (KIN-144): emitir o revocar una API key usando una
// API key es escalada de privilegio. No migrar a getAuthContext.
async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });

  const keys = await listApiKeys(session.user.id);
  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { token, record } = await generateApiKey(session.user.id, parsed.data.name);
  return NextResponse.json({ token, ...record }, { status: 201 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteApiKey(session.user.id, id);
  if (!deleted) return NextResponse.json({ code: 'NOT_FOUND', message: 'API key not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
