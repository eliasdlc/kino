import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { db } from '@/shared/db';
import { accounts, sessions, users } from '@/shared/db/schema';

export async function selectUserAccount(userId: string) {
  const [row] = await db
    .select({ name: users.name, email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/** Cómo entra la cuenta: `credential` con contraseña, y/o proveedores OAuth. */
export async function selectSignInMethods(userId: string) {
  const rows = await db
    .select({ providerId: accounts.providerId, password: accounts.password })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  return rows.map((r) => ({ providerId: r.providerId, hasPassword: r.password !== null }));
}

export async function updateUserName(userId: string, name: string) {
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function selectActiveSessions(userId: string) {
  return db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.updatedAt));
}

/** `false` si la sesión no existe o no es de este usuario. */
export async function deleteSessionById(userId: string, sessionId: string): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  return deleted.length > 0;
}

/** Cierra todas las sesiones del usuario menos una. Devuelve cuántas cerró. */
export async function deleteSessionsExcept(userId: string, keepSessionId: string): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)))
    .returning({ id: sessions.id });
  return deleted.length;
}

/**
 * Borra la fila de `users`. Todo lo demás del usuario cae por `onDelete:
 * cascade` en el schema: sistemas, tareas, páginas, sesiones, cuentas OAuth,
 * claves API, tokens del MCP, suscripciones push.
 */
export async function deleteUserRow(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}
