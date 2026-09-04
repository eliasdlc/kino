import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/shared/db';
import { rateLimits } from '@/shared/db/schema';
import { guardApiRequest, MUTATION_POLICY } from '@/shared/rate-limit';

/**
 * El límite por credencial contra Postgres de verdad.
 *
 * La afirmación del ticket es que el bloqueo sobrevive al cambio de instancia, y
 * eso no se puede probar con un contador inyectado: hay que ver que el estado
 * está fuera del proceso. Aquí no se pasa ningún `store`, así que cada llamada
 * resuelve el de Postgres por su cuenta — igual que haría un arranque en frío
 * distinto — y todas ven el mismo número.
 *
 * El reloj sí entra por parámetro: sin él, un test que corre justo en el borde de
 * un minuto empezaría una ventana nueva a mitad y fallaría de vez en cuando.
 */

const NOW = 1_700_000_000_000;

/** Una mutación con una clave API: la credencial es la identidad del contador. */
function mutation(key: string): NextRequest {
  return new NextRequest('http://localhost/api/tasks', {
    method: 'POST',
    headers: new Headers({ authorization: `Bearer ${key}` }),
  });
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${rateLimits}`);
});

describe('por credencial · el contador vive en la base, no en el proceso', () => {
  const KEY = 'sk-kino-una-clave';

  it('acumula entre llamadas que no comparten nada más que Postgres', async () => {
    for (let i = 0; i < MUTATION_POLICY.limit; i++) {
      expect(await guardApiRequest(mutation(KEY), { now: NOW })).toBeNull();
    }

    const blocked = await guardApiRequest(mutation(KEY), { now: NOW });
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
  });

  it('guarda una sola fila por credencial y bucket, reutilizada', async () => {
    for (let i = 0; i < 4; i++) {
      await guardApiRequest(mutation(KEY), { now: NOW });
    }

    const rows = await db.select().from(rateLimits);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hits).toBe(4);
    // La clave no se guarda en claro: la columna lleva su hash.
    expect(rows[0]!.identity.startsWith('key:')).toBe(true);
    expect(rows[0]!.identity).not.toContain(KEY);
  });

  it('la ventana siguiente arranca de cero', async () => {
    for (let i = 0; i <= MUTATION_POLICY.limit; i++) {
      await guardApiRequest(mutation(KEY), { now: NOW });
    }
    expect((await guardApiRequest(mutation(KEY), { now: NOW }))?.status).toBe(429);

    const nextWindow = NOW + MUTATION_POLICY.windowMs;
    expect(await guardApiRequest(mutation(KEY), { now: nextWindow })).toBeNull();
  });

  it('otra credencial no hereda el bloqueo', async () => {
    for (let i = 0; i <= MUTATION_POLICY.limit; i++) {
      await guardApiRequest(mutation(KEY), { now: NOW });
    }

    expect(await guardApiRequest(mutation('sk-kino-otra'), { now: NOW })).toBeNull();
  });
});
