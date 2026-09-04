import { and, eq } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/shared/db';
import { accounts, users } from '@/shared/db/schema';

export interface LinkedUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/** Cómo se marca en `accounts` la fila que une una identidad de Clerk con `users`. */
const CLERK_PROVIDER = 'clerk';

const USER_COLUMNS = { id: users.id, name: users.name, email: users.email, image: users.image };

/**
 * El usuario de Kino detrás de una identidad de Clerk.
 *
 * La correspondencia vive en `accounts` (`providerId = 'clerk'`, `accountId` =
 * id de Clerk), que ya existe y tiene índice: así Postgres no necesita una
 * columna nueva mientras dura la transición. La primera vez que una identidad
 * llega sin fila se resuelve contra Clerk una sola vez: por `externalId` si el
 * importador lo dejó, por correo si la cuenta ya existía, y si no se crea.
 */
export async function linkClerkUser(clerkId: string): Promise<LinkedUser> {
  const [linked] = await db
    .select(USER_COLUMNS)
    .from(accounts)
    .innerJoin(users, eq(users.id, accounts.userId))
    .where(and(eq(accounts.providerId, CLERK_PROVIDER), eq(accounts.accountId, clerkId)))
    .limit(1);
  if (linked) return linked;

  const clerk = await (await clerkClient()).users.getUser(clerkId);
  const email = clerk.primaryEmailAddress?.emailAddress;
  if (!email) throw new Error(`La identidad ${clerkId} no tiene correo principal`);

  const existing = clerk.externalId
    ? await selectUser(eq(users.id, clerk.externalId))
    : await selectUser(eq(users.email, email));
  const user = existing ?? (await createUser(clerk, email));

  await db.insert(accounts).values({ userId: user.id, providerId: CLERK_PROVIDER, accountId: clerkId });
  return user;
}

async function selectUser(where: ReturnType<typeof eq>): Promise<LinkedUser | null> {
  const [row] = await db.select(USER_COLUMNS).from(users).where(where).limit(1);
  return row ?? null;
}

async function createUser(
  clerk: { firstName: string | null; lastName: string | null; imageUrl: string; hasImage: boolean },
  email: string,
): Promise<LinkedUser> {
  const name = [clerk.firstName, clerk.lastName].filter(Boolean).join(' ') || email.split('@')[0];
  const [row] = await db
    .insert(users)
    .values({
      email,
      emailVerified: true,
      name,
      image: clerk.hasImage ? clerk.imageUrl : null,
    })
    .returning(USER_COLUMNS);
  return row;
}
