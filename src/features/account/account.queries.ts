import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { users } from '@/shared/db/schema';

export async function selectUserAccount(userId: string) {
  const [row] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Borra la fila de `users`. Todo lo demás del usuario cae por `onDelete:
 * cascade` en el schema: sistemas, tareas, páginas, claves API, suscripciones
 * push y la fila que lo unía a su identidad de Clerk.
 */
export async function deleteUserRow(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}
