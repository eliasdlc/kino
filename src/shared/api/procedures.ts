import { os, ORPCError } from "@orpc/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { allowsScope, scopeForMethod } from "@/shared/lib/scopes";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/utils/error";
import type { ApiMeta } from "./contract";

/**
 * Lo que el handler de Next le entrega a oRPC. `request` es el crudo, que hace
 * falta para resolver la credencial: puede venir en una cookie, en una clave
 * API o en un token OAuth.
 */
export interface ApiContext {
  request: NextRequest;
  /**
   * Cabeceras de la respuesta, que pone `ResponseHeadersPlugin`. Sólo las tocan
   * las operaciones que emiten cookies; el resto devuelve datos y ya.
   */
  resHeaders?: Headers;
}

/** Lo que las middlewares añaden y los handlers consumen. */
export interface AuthedContext {
  userId: string;
  sessionId: string | undefined;
}

/**
 * Cada slice monta su implementador con estas dos middlewares:
 *
 *     const os = implement(miContrato)
 *       .$context<ApiContext>()
 *       .use(translateDomainErrors)
 *       .use(authenticate);
 *
 * La cadena se repite en vez de esconderse en un helper porque un helper
 * genérico sobre el contrato pierde los tipos: TypeScript no resuelve el
 * condicional de `implement()` hasta que el contrato es concreto, y los
 * handlers acaban recibiendo `any`. Tres líneas por slice a cambio de que la
 * entrada y la salida de cada endpoint sigan tipadas es un buen trato.
 */

const base = os.$context<ApiContext>().$meta<ApiMeta>({});

/** El mismo punto de partida, ya con lo que `authenticate` deja en el contexto. */
const authed = os.$context<ApiContext & AuthedContext>().$meta<ApiMeta>({});

/**
 * Traduce los errores del dominio al código y al status que ya eran contrato
 * con el frontend y con el MCP. Es el mismo mapeo que hacía `route()`, movido
 * de sitio y no reinventado.
 *
 * El 422 no es un 400: el request llegó bien formado y el schema lo aceptó; lo
 * que lo rechaza es una regla de dominio. Es lo que distingue "no te entiendo"
 * de "te entiendo y no". El 400 de schema lo produce la validación de oRPC y se
 * le da forma en el handler.
 */
export const translateDomainErrors = base.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new ORPCError("NOT_FOUND", { status: 404, message: error.message });
    }
    if (error instanceof ForbiddenError) {
      throw new ORPCError("FORBIDDEN", { status: 403, message: error.message });
    }
    if (error instanceof ValidationError) {
      throw new ORPCError("VALIDATION_ERROR", { status: 422, message: error.message });
    }
    if (error instanceof ConflictError) {
      throw new ORPCError("CONFLICT", { status: 409, message: error.message });
    }
    throw error;
  }
});

/**
 * Estrecha `sessionId` a `string` para los slices que sólo se sirven desde el
 * navegador. Quien exige la sesión es `authenticate`, leyendo `meta.sessionOnly`
 * del contrato — así no se puede olvidar. Esto lo dice además en el tipo, y de
 * paso protege a quien lo use sin declarar la meta.
 */
export const requireSession = authed.middleware(async ({ context, next }) => {
  if (!context.sessionId) {
    throw new ORPCError("SESSION_REQUIRED", {
      status: 403,
      message: "Esta acción sólo se puede hacer desde la sesión del navegador",
    });
  }
  return next({ context: { sessionId: context.sessionId } });
});

/**
 * El 400 de un schema que no se puede declarar en el contrato porque depende de
 * datos: la metadata de una carpeta la valida un Zod distinto según el
 * arquetipo del sistema dueño, y eso sólo se sabe después de leerlo.
 *
 * Sale con el mismo cuerpo que el 400 del contrato, `details` incluido.
 */
export function schemaError(message: string, details: unknown) {
  return new ORPCError("VALIDATION_ERROR", { status: 400, message, data: { details } });
}

/**
 * Resuelve la credencial y el permiso antes de que el handler exista.
 *
 * El scope se deriva del método declarado en el contrato, y `meta.scope` es la
 * excepción. Si una operación no declara método, se le exige escritura: fallar
 * hacia el permiso más alto es el único default que no abre nada por descuido.
 */
export const authenticate = base.middleware(async ({ context, procedure, next }) => {
  const auth = await getAuthContext(context.request);
  if (!auth) {
    throw new ORPCError("UNAUTHORIZED", { status: 401, message: "Unauthorized" });
  }

  const { route, meta } = procedure["~orpc"];
  const requiredScope = meta.scope ?? scopeForMethod(route.method ?? "POST");
  // 403 y no 401: sabemos quién eres, lo que falta es el permiso. El cuerpo
  // nombra el scope para que el cliente pueda pedirlo y reintentar.
  if (!allowsScope(auth.scopes, requiredScope)) {
    throw new ORPCError("INSUFFICIENT_SCOPE", {
      status: 403,
      message: `Este token no tiene el permiso ${requiredScope}`,
      data: { requiredScope },
    });
  }

  if (meta.sessionOnly && !auth.sessionId) {
    throw new ORPCError("SESSION_REQUIRED", {
      status: 403,
      message: "Esta acción sólo se puede hacer desde la sesión del navegador",
    });
  }

  return next({ context: { userId: auth.userId, sessionId: auth.sessionId } });
});
