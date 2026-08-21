import { NextRequest } from 'next/server';
import { validateApiKey } from '@/features/api-keys/api-keys.service';
import { verifyOAuthToken } from '@/shared/lib/oauth-resource';
import { OWNER, type AuthScopes } from '@/shared/lib/scopes';
import { getServerSession } from './session';

export interface AuthContext {
  userId: string;
  /**
   * Con qué permisos. Antes se perdía aquí: `verifyOAuthToken` extraía los
   * scopes del token y este borde los tiraba, así que ninguna ruta podía
   * comprobarlos.
   */
  scopes: AuthScopes;
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Personal API keys (CLI / stdio MCP) are prefixed; anything else is
    // treated as an OAuth 2.1 access token from the web MCP connector.
    if (token.startsWith('sk-kino-')) {
      const userId = await validateApiKey(token);
      return userId ? { userId, scopes: OWNER } : null;
    }
    const claims = await verifyOAuthToken(token);
    return claims ? { userId: claims.userId, scopes: { kind: 'oauth', granted: claims.scopes } } : null;
  }
  const session = await getServerSession();
  return session ? { userId: session.user.id, scopes: OWNER } : null;
}
