import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/shared/utils/auth-context';
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

type RouteParams = Record<string, string>;

export interface RouteConfig<TBody, TQuery, TParams extends RouteParams> {
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
}

export interface RouteHandlerArgs<TBody, TQuery, TParams extends RouteParams> {
  userId: string;
  body: TBody;
  query: TQuery;
  params: TParams;
  request: NextRequest;
}

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
  if (error instanceof ValidationError) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: error.message }, { status: 400 });
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
  return function withConfig<TBody = undefined, TQuery = undefined>(
    config: RouteConfig<TBody, TQuery, TParams>,
    handler: (args: RouteHandlerArgs<TBody, TQuery, TParams>) => Promise<Response> | Response,
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
        return await handler({ userId: auth.userId, body, query, params, request });
      } catch (error) {
        return mapError(error);
      }
    };
  };
}
