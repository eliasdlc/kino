import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/shared/db';
import { rateLimits } from '@/shared/db/schema';
import { AUTH_ACCOUNT_POLICY, AUTH_CREDENTIAL_POLICY, guardApiRequest } from '@/shared/rate-limit';
import {
  clearSignInAttempts,
  guardSignInAttempt,
} from '@/shared/rate-limit/sign-in-attempts';

/**
 * El límite de accesos contra Postgres de verdad (KIN-161).
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

function signIn(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/sign-in/email', {
    method: 'POST',
    headers: new Headers({ 'x-forwarded-for': ip }),
  });
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${rateLimits}`);
});

describe('por IP · el contador vive en la base, no en el proceso', () => {
  it('acumula entre llamadas que no comparten nada más que Postgres', async () => {
    for (let i = 0; i < AUTH_CREDENTIAL_POLICY.limit; i++) {
      expect(await guardApiRequest(signIn('203.0.113.9'), { now: NOW })).toBeNull();
    }

    const blocked = await guardApiRequest(signIn('203.0.113.9'), { now: NOW });
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
  });

  it('guarda una sola fila por IP y bucket, reutilizada', async () => {
    for (let i = 0; i < 4; i++) {
      await guardApiRequest(signIn('203.0.113.9'), { now: NOW });
    }

    const rows = await db.select().from(rateLimits);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hits).toBe(4);
    // La dirección no se guarda en claro: la columna lleva su hash.
    expect(rows[0]!.identity.startsWith('ip:')).toBe(true);
    expect(rows[0]!.identity).not.toContain('203.0.113.9');
  });

  it('la ventana siguiente arranca de cero', async () => {
    for (let i = 0; i <= AUTH_CREDENTIAL_POLICY.limit; i++) {
      await guardApiRequest(signIn('203.0.113.9'), { now: NOW });
    }
    expect((await guardApiRequest(signIn('203.0.113.9'), { now: NOW }))?.status).toBe(429);

    const nextWindow = NOW + AUTH_CREDENTIAL_POLICY.windowMs;
    expect(await guardApiRequest(signIn('203.0.113.9'), { now: nextWindow })).toBeNull();
  });

  it('una IP distinta no hereda el bloqueo de la otra', async () => {
    for (let i = 0; i <= AUTH_CREDENTIAL_POLICY.limit; i++) {
      await guardApiRequest(signIn('203.0.113.9'), { now: NOW });
    }

    expect(await guardApiRequest(signIn('198.51.100.4'), { now: NOW })).toBeNull();
  });
});

describe('por cuenta · nadie puede dejar fuera al dueño', () => {
  const EMAIL = 'elias@usekino.dev';
  const ATTACKER = '203.0.113.9';
  const OWNER = '198.51.100.4';

  async function exhaust(ip: string) {
    for (let i = 0; i < AUTH_ACCOUNT_POLICY.limit; i++) {
      expect(await guardSignInAttempt(EMAIL, ip, { now: NOW })).toBeNull();
    }
  }

  it('bloquea a quien prueba contraseñas contra la cuenta', async () => {
    await exhaust(ATTACKER);
    expect((await guardSignInAttempt(EMAIL, ATTACKER, { now: NOW }))?.allowed).toBe(false);
  });

  it('el dueño entra desde su IP mientras la del atacante sigue bloqueada', async () => {
    await exhaust(ATTACKER);
    expect((await guardSignInAttempt(EMAIL, ATTACKER, { now: NOW }))?.allowed).toBe(false);

    expect(await guardSignInAttempt(EMAIL, OWNER, { now: NOW })).toBeNull();
  });

  it('acertar borra la fila, así que los fallos previos no se arrastran', async () => {
    await guardSignInAttempt(EMAIL, OWNER, { now: NOW });
    await guardSignInAttempt(EMAIL, OWNER, { now: NOW });

    await clearSignInAttempts(EMAIL, OWNER);

    const remaining = await db.select().from(rateLimits);
    expect(remaining.filter((row) => row.bucket === AUTH_ACCOUNT_POLICY.bucket)).toHaveLength(0);
  });

  it('limpiar una cuenta no toca el contador de la otra', async () => {
    await guardSignInAttempt(EMAIL, OWNER, { now: NOW });
    await guardSignInAttempt('otra@usekino.dev', OWNER, { now: NOW });

    await clearSignInAttempts(EMAIL, OWNER);

    const remaining = await db.select().from(rateLimits);
    expect(remaining).toHaveLength(1);
  });
});
