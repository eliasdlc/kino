import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { validateApiKey } from '@/features/api-keys/api-keys.service';

export async function getAuthContext(
  request: NextRequest,
): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const userId = await validateApiKey(token);
    return userId ? { userId } : null;
  }
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { userId: session.user.id } : null;
}
