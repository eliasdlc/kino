import { sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { users } from '@/shared/db/schema';

/**
 * Datos comunes a la batería de integración (`*.itest.ts`), la que corre contra
 * un Postgres de verdad y no entra en `pnpm test`.
 *
 * Contra una base real y no con `db` mockeado a propósito: un mock sólo confirma
 * que la consulta lleva el filtro, no que Postgres lo respete, ni que el `ltree`
 * case, ni que una transacción revierta. Esas son las preguntas de esta batería.
 *
 * Quién levanta y apaga la base: `testing/setup.ts`.
 */

/** Las dos cuentas del experimento: A intenta tocar lo de B. */
export interface Actors {
  alice: string;
  bob: string;
}

const TEST_EMAIL_DOMAIN = 'isolation.test';

/**
 * Deja la base como si acabara de crearse y devuelve dos usuarios nuevos.
 *
 * El TRUNCATE va en cascada desde `users`, que es de quien cuelga todo lo que
 * tiene dueño. Se hace por test y no una vez, para que el orden de los tests
 * no pueda cambiar el resultado.
 */
export async function resetAndSeedActors(): Promise<Actors> {
  await db.execute(sql`TRUNCATE TABLE ${users} RESTART IDENTITY CASCADE`);

  const [alice, bob] = await db
    .insert(users)
    .values([
      { name: 'Alice', email: `alice@${TEST_EMAIL_DOMAIN}`, emailVerified: true, timezone: 'UTC' },
      { name: 'Bob', email: `bob@${TEST_EMAIL_DOMAIN}`, emailVerified: true, timezone: 'UTC' },
    ])
    .returning({ id: users.id });

  return { alice: alice!.id, bob: bob!.id };
}
