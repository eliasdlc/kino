import { NextRequest } from 'next/server';
import { validateApiKey } from '@/features/api-keys/api-keys.service';
import { OWNER, type AuthScopes } from '@/shared/lib/scopes';
import { getServerSession } from './session';

export interface AuthContext {
  userId: string;
  /** Con qué permisos entra: dueño desde el navegador o una clave, o lo que un token conceda. */
  scopes: AuthScopes;
  /**
   * Sesión de navegador que autenticó el request. Ausente cuando entró con una
   * clave API: es lo que permite a una ruta exigir "sólo desde el navegador"
   * para lo que toca credenciales.
   */
  sessionId?: string;
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Claves personales del CLI y del MCP local. Cualquier otro Bearer es un
    // token OAuth, y ese lo emite Clerk y lo valida el MCP remoto por su cuenta.
    if (!token.startsWith('sk-kino-')) return null;
    const userId = await validateApiKey(token);
    return userId ? { userId, scopes: OWNER } : null;
  }
  const session = await getServerSession();
  return session ? { userId: session.user.id, scopes: OWNER, sessionId: session.session.id } : null;
}
