import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/shared/utils/auth-context';
import { allowsScope, KINO_READ, KINO_WRITE, type KinoScope } from '@/shared/lib/scopes';
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/utils/error';

/**
 * Wrapper de handlers de API (KIN-145 / BE-08 · AR-01).
 *
 * Centraliza el preámbulo que cada ruta repetía a mano — auth, parseo y
 * validación del body, mapeo de errores a status — para que no se pueda
 * olvidar una pieza. Lo que NO hace es decidir el shape de la respuesta feliz:
 * el handler devuelve su propia `Response`, porque los status y bodies
 * existentes son contrato con el frontend y el wrapper se adapta a ellos.
 *
 * El handler recibe `{ userId, body, query, params, request }` ya resueltos.
 * `request` queda expuesto para las rutas que necesitan el crudo (FormData en
 * uploads, por ejemplo) sin pelearse con el wrapper.
 */

const UNAUTHORIZED = { code: 'UNAUTHORIZED', message: 'Unauthorized' };

/**
 * El scope que exige una ruta sale del método, no de una anotación por ruta.
 * Anotar cien handlers a mano es cien sitios donde olvidarlo; derivarlo del
 * verbo acierta por defecto y deja `requiredScope` para las excepciones, que
 * son los POST que en realidad sólo leen.
 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function scopeForMethod(method: string): KinoScope {
  return WRITE_METHODS.has(method.toUpperCase()) ? KINO_WRITE : KINO_READ;
}

type RouteParams = Record<string, string>;

export interface RouteConfig<
  TBody,
  TQuery,
  TParams extends RouteParams,
  TSessionOnly extends boolean = false,
> {
  /** Schema del body JSON. Si se omite, el body no se lee ni se valida. */
  body?: z.ZodType<TBody>;
  /** Schema de los search params, recibidos como objeto plano de strings. */
  query?: z.ZodType<TQuery>;
  /**
   * Escotilla para las rutas cuyo schema de body incluye un valor que viaja en
   * la URL (p. ej. `systemId` en `POST /api/systems/[id]/entities`). Se aplica
   * al crudo, antes de validar.
   */
  prepareBody?: (raw: unknown, params: TParams) => unknown;
  /**
   * Sobreescribe el scope que se deriva del método. Se usa en los POST que
   * sólo leen (`/api/insights/estimate` y compañía), donde exigir `kino:write`
   * sería mentir sobre lo que hace la ruta.
   */
  requiredScope?: KinoScope;
  /**
   * Exige la sesión del navegador: una clave API o un token OAuth del MCP
   * recibe 403 aunque pertenezcan al mismo usuario. Es para lo que cambia
   * credenciales, cierra sesiones o borra la cuenta, donde un token filtrado
   * no debe bastar.
   */
  sessionOnly?: TSessionOnly;
}

export interface RouteHandlerArgs<
  TBody,
  TQuery,
  TParams extends RouteParams,
  TSessionOnly extends boolean = false,
> {
  userId: string;
  /** Id de la sesión de navegador. Garantizado sólo con `sessionOnly`. */
  sessionId: TSessionOnly extends true ? string : string | undefined;
  body: TBody;
  query: TQuery;
  params: TParams;
  request: NextRequest;
}

/** 400: el body o la query no pasan el schema. Ver `mapError` para el 422. */
function validationResponse(message: string, details?: unknown) {
  return NextResponse.json(
    details === undefined
      ? { code: 'VALIDATION_ERROR', message }
      : { code: 'VALIDATION_ERROR', message, details },
    { status: 400 },
  );
}

/**
 * Mapea por clase de error. Las subclases van antes que cualquier caso
 * genérico. El 500 es el único que loguea: hoy ese error se pierde en un
 * `catch {}` sin binding y en producción aparece como un 500 mudo.
 */
function mapError(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ code: 'NOT_FOUND', message: error.message }, { status: 404 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ code: 'FORBIDDEN', message: error.message }, { status: 403 });
  }
  // 422 y no 400: el request llegó bien formado y el schema lo aceptó; lo que
  // lo rechaza es una regla de dominio (una transición imposible, una fecha
  // fuera de rango). Es la convención que ya tenían `tasks` y `energy`, y la
  // que distingue "no te entiendo" de "te entiendo y no".
  if (error instanceof ValidationError) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: error.message }, { status: 422 });
  }
  console.error('[route] unhandled error:', error);
  return NextResponse.json(
    { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    { status: 500 },
  );
}

/**
 * Se usa en dos pasos —`route<{ id: string }>()({ … }, handler)`— y el paréntesis
 * vacío no es un capricho: TypeScript no infiere los genéricos a medias. Así el
 * único que se escribe a mano es el de `params`, mientras `body` y `query` se
 * deducen de sus schemas Zod y no pueden declararse distintos de lo que valida.
 * Rutas sin params: `route()({ … }, handler)`.
 */
export function route<TParams extends RouteParams = RouteParams>() {
  return function withConfig<
    TBody = undefined,
    TQuery = undefined,
    TSessionOnly extends boolean = false,
  >(
    config: RouteConfig<TBody, TQuery, TParams, TSessionOnly>,
    handler: (
      args: RouteHandlerArgs<TBody, TQuery, TParams, TSessionOnly>,
    ) => Promise<Response> | Response,
  ) {
    // Ni `context` ni `params` llevan `?`: Next 16 genera para cada ruta un tipo
    // que exige que el segundo parámetro acepte su `RouteContext`, y un
    // `undefined` en la firma no satisface esa restricción (`pnpm typecheck`
    // falla dentro de `.next/types`). En runtime Next siempre pasa el objeto; el
    // acceso de abajo se mantiene defensivo por las llamadas directas de los tests.
    return async function wrappedHandler(
      request: NextRequest,
      context: { params: Promise<TParams> },
    ): Promise<Response> {
      const auth = await getAuthContext(request);
      if (!auth) return NextResponse.json(UNAUTHORIZED, { status: 401 });

      // 403 y no 401: sabemos quién eres, lo que falta es el permiso. El
      // cuerpo nombra el scope para que el cliente pueda pedirlo y reintentar.
      const requiredScope = config.requiredScope ?? scopeForMethod(request.method);
      if (!allowsScope(auth.scopes, requiredScope)) {
        return NextResponse.json(
          {
            code: 'INSUFFICIENT_SCOPE',
            message: `Este token no tiene el permiso ${requiredScope}`,
            requiredScope,
          },
          { status: 403 },
        );
      }

      if (config.sessionOnly && !auth.sessionId) {
        return NextResponse.json(
          {
            code: 'SESSION_REQUIRED',
            message: 'Esta acción sólo se puede hacer desde la sesión del navegador',
          },
          { status: 403 },
        );
      }
      const sessionId = auth.sessionId as RouteHandlerArgs<
        TBody,
        TQuery,
        TParams,
        TSessionOnly
      >['sessionId'];

      const params = ((await context?.params) ?? {}) as TParams;

      let body = undefined as TBody;
      if (config.body) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return validationResponse('Invalid JSON body');
        }
        if (config.prepareBody) raw = config.prepareBody(raw, params);
        const parsed = config.body.safeParse(raw);
        if (!parsed.success) return validationResponse('Invalid input', parsed.error.flatten());
        body = parsed.data;
      }

      let query = undefined as TQuery;
      if (config.query) {
        const raw = Object.fromEntries(new URL(request.url).searchParams);
        const parsed = config.query.safeParse(raw);
        if (!parsed.success) return validationResponse('Invalid input', parsed.error.flatten());
        query = parsed.data;
      }

      try {
        return await handler({ userId: auth.userId, sessionId, body, query, params, request });
      } catch (error) {
        return mapError(error);
      }
    };
  };
}
