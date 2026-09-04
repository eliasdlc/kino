// Lleva los usuarios de Postgres a Clerk. Ninguno tiene contraseña propia
// (entran con Google), así que se crean con correo, nombre y `externalId` =
// id de Postgres, y Clerk los reconoce cuando vuelven a entrar con Google.
// Idempotente: un correo que ya existe en Clerk no se vuelve a crear.
//
// Uso: CLERK_SECRET_KEY=... pnpm tsx scripts/migrate-to-convex/users.mts --source <url>
import { parseArgs } from 'node:util';
import { createClerkClient } from '@clerk/nextjs/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../../src/shared/db/schema';

const { values: flags } = parseArgs({ options: { source: { type: 'string' } } });
const source = flags.source ?? process.env.SOURCE_DATABASE_URL;
const secretKey = process.env.CLERK_SECRET_KEY;
if (!source || !secretKey) throw new Error('Faltan --source o CLERK_SECRET_KEY');

const clerk = createClerkClient({ secretKey });
const client = postgres(source, { max: 1 });
try {
  for (const row of await drizzle(client).select().from(users)) {
    const { data: existing } = await clerk.users.getUserList({ emailAddress: [row.email] });
    if (existing.length > 0) {
      console.log(`${row.email}: ya existe en Clerk (${existing[0].id})`);
      continue;
    }
    const [firstName, ...rest] = row.name.split(' ');
    const created = await clerk.users.createUser({
      emailAddress: [row.email],
      // La instancia exige nombre de usuario; sale del correo y nadie lo ve.
      username: row.email.split('@')[0].replace(/[^a-z0-9_-]/gi, '').toLowerCase(),
      firstName,
      lastName: rest.join(' ') || undefined,
      externalId: row.id,
      skipPasswordRequirement: true,
    });
    console.log(`${row.email}: creado (${created.id})`);
  }
} finally {
  await client.end();
}
