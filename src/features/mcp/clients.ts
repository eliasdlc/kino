import { fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { MCP_CLIENTS_SUBJECT } from "@convex/lib/mcpClients";
import type { Scope } from "@convex/lib/scopes";
import { mintConvexToken } from "@/features/mcp/auth";

/**
 * Anotar qué cliente OAuth llama a `/api/mcp`, y saber si la persona ya lo
 * desconectó. Mismo patrón que `src/shared/rate-limit/store.ts` (token del
 * servicio firmado una vez por instancia), con la diferencia que importa: allí
 * un contador que no responde deja pasar, aquí **no**. Si Convex no contesta no
 * se sabe si el cliente está revocado, y dejarlo pasar sería abrirle la puerta
 * a quien la persona cerró. El error sube hasta `withServerFaults`, que lo
 * contesta como 503 con su motivo.
 */

/** Lo más que la ruta espera a Convex antes de dar la petición por fallida. */
const TOPE_MS = 5_000;

/** El token vive diez minutos; se renueva uno antes para no mandarlo caducado. */
const RENOVAR_TOKEN_MS = 9 * 60 * 1000;

let token: { valor: Promise<string>; hasta: number } | undefined;

/**
 * El token con el que la ruta se presenta ante Convex como el servicio. Si la
 * firma falla no se guarda, para que la siguiente petición lo reintente.
 */
function tokenDelServicio(now: number): Promise<string> {
  if (!token || now >= token.hasta) {
    const valor = mintConvexToken({ clerkId: MCP_CLIENTS_SUBJECT, scope: "read" });
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
    reloj = setTimeout(() => rechazar(new Error(`Convex no respondió en ${TOPE_MS} ms al registrar el cliente`)), TOPE_MS);
  });
  try {
    return await Promise.race([promesa, tope]);
  } finally {
    clearTimeout(reloj);
  }
}

export type RegistroDeCliente = { clerkId: string; clientId: string; scope: Scope; clientName?: string };

/** Anota la llamada del cliente y devuelve si está revocado. Lanza si Convex no responde. */
export function registrarCliente(input: RegistroDeCliente): Promise<{ revocado: boolean }> {
  return conTope(
    (async () => {
      const credencial = await tokenDelServicio(Date.now());
      return fetchMutation(api.mcpClients.registrar, input, { token: credencial });
    })(),
  );
}

/** El `name` de un `clientInfo` suelto, o nada si no es un texto. */
function nombreDe(clientInfo: unknown): string | undefined {
  if (typeof clientInfo !== "object" || clientInfo === null) return undefined;
  const name = (clientInfo as { name?: unknown }).name;
  return typeof name === "string" && name.trim() !== "" ? name : undefined;
}

/** Un mensaje JSON-RPC suelto: su `initialize` trae el cliente en los params; el resto, en `_meta`. */
function nombreEnMensaje(mensaje: unknown): string | undefined {
  if (typeof mensaje !== "object" || mensaje === null) return undefined;
  const { method, params } = mensaje as { method?: unknown; params?: unknown };
  if (typeof params !== "object" || params === null) return undefined;
  const { clientInfo, _meta } = params as { clientInfo?: unknown; _meta?: unknown };
  if (method === "initialize") return nombreDe(clientInfo);
  if (typeof _meta !== "object" || _meta === null) return undefined;
  return nombreDe((_meta as { clientInfo?: unknown }).clientInfo);
}

/**
 * Cómo se llama el cliente según el protocolo, o nada. Se lee del cuerpo sin
 * consumirlo (`clone`) y sin fiarse de él: un cuerpo que no es JSON, vacío o de
 * otra forma da `undefined`, y la fila queda como «Cliente sin nombre». En un
 * lote vale el primer mensaje. Solo etiqueta; la identidad es el `client_id`
 * que verificó Clerk.
 */
export async function clientNameOf(req: Request): Promise<string | undefined> {
  if (req.method !== "POST") return undefined;
  try {
    const cuerpo: unknown = await req.clone().json();
    return nombreEnMensaje(Array.isArray(cuerpo) ? cuerpo[0] : cuerpo);
  } catch {
    return undefined;
  }
}
