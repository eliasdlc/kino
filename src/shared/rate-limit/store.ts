import { fetchMutation } from 'convex/nextjs';
import { api } from '@convex/_generated/api';
import { RATE_LIMIT_SUBJECT } from '@convex/lib/mcpToken';
import { mintConvexToken } from '@/features/mcp/auth';

/**
 * El contador de peticiones por identidad y cubo. Vive en la tabla
 * `rateLimits` de Convex (`convex/rateLimits.ts`), que comparten todas las
 * instancias de Vercel: una instancia nueva o un arranque en frío siguen
 * contando donde se quedó la anterior.
 */
export interface RateLimitStore {
  /** Cuenta esta request y devuelve el total acumulado en la ventana. */
  hit(identity: string, bucket: string, windowStart: Date): Promise<number>;
}

/**
 * Lo más que el proxy espera al contador. Pasado esto la request sigue como si
 * Convex no respondiera: un contador lento no debe sumar segundos a cada
 * petición que protege.
 */
const TOPE_MS = 1_500;

/** El token vive diez minutos; se renueva uno antes para no mandarlo caducado. */
const RENOVAR_TOKEN_MS = 9 * 60 * 1000;

let token: { valor: Promise<string>; hasta: number } | undefined;

/**
 * El token con el que el proxy se presenta ante Convex como el servicio y no
 * como una persona. Se firma una vez por instancia cada nueve minutos, no en
 * cada request; si la firma falla no se guarda, para que la siguiente lo
 * reintente.
 */
function tokenDelServicio(now: number): Promise<string> {
  if (!token || now >= token.hasta) {
    const valor = mintConvexToken({ clerkId: RATE_LIMIT_SUBJECT, scope: 'read' });
    token = { valor, hasta: now + RENOVAR_TOKEN_MS };
    valor.catch(() => {
      if (token?.valor === valor) token = undefined;
    });
  }
  return token.valor;
}

async function conTope<T>(promesa: Promise<T>): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`el contador no respondió en ${TOPE_MS} ms`)), TOPE_MS);
  });
  try {
    return await Promise.race([promesa, tope]);
  } finally {
    clearTimeout(reloj);
  }
}

export const convexRateLimitStore: RateLimitStore = {
  async hit(identity, bucket, windowStart) {
    return conTope(
      (async () => {
        const credencial = await tokenDelServicio(Date.now());
        return fetchMutation(
          api.rateLimits.hit,
          { identity, bucket, windowStart: windowStart.getTime() },
          { token: credencial },
        );
      })(),
    );
  },
};
