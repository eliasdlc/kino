import { NextRequest } from 'next/server';
import { validateApiKey } from '@/features/api-keys/api-keys.service';
import { verifyOAuthToken } from '@/shared/lib/oauth-resource';
import { getServerSession } from './session';

export async function getAuthContext(
  request: NextRequest,
): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Personal API keys (CLI / stdio MCP) are prefixed; anything else is
    // treated as an OAuth 2.1 access token from the web MCP connector.
    if (token.startsWith('sk-kino-')) {
      const userId = await validateApiKey(token);
      return userId ? { userId } : null;
    }
    const claims = await verifyOAuthToken(token);
    return claims ? { userId: claims.userId } : null;
  }
  const session = await getServerSession();
  return session ? { userId: session.user.id } : null;
}
