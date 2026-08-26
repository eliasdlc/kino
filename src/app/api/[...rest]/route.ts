import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/api/handler";

/**
 * La puerta de la API. Todo lo que responde JSON pasa por aquí.
 *
 * Es un catch-all a propósito: Next resuelve antes cualquier `route.ts` más
 * específico, así que aquí sólo llega lo que ningún archivo reclama. Añadir un
 * endpoint es añadir una operación al contrato de su slice; no se toca `app/`.
 *
 * Los `route.ts` que quedan son los que no caben en el contrato, y cada uno por
 * una razón concreta:
 *
 * | Ruta | Por qué se queda fuera |
 * |---|---|
 * | `/api/auth/[...all]` | Es el handler de Better Auth, no nuestro |
 * | `/api/mcp` | Se autentica sola por OAuth y declara `maxDuration = 60` |
 * | `/api/cron/*` | Autentican con `CRON_SECRET`, no con la credencial de un usuario, y declaran `maxDuration` |
 * | `/api/connect/cli` | La respuesta feliz es un 302 al puerto local del CLI |
 * | `/api/integrations/github/{connect,callback}` | Los dos terminan en un 302, no en JSON |
 * | `/api/export/workspace`, `/api/systems/[id]/export` | Devuelven un ZIP y una cabecera propia, no un cuerpo JSON |
 * | `/api/uploads`, `/api/uploads/sweep` | La primera recibe la imagen cruda y necesita el `request`; la segunda declara `maxDuration` |
 *
 * Las dos de `uploads` son las únicas que siguen usando el wrapper `route()`,
 * que se queda para eso: la escotilla de lo que no encaja.
 */
async function handle(request: NextRequest): Promise<Response> {
  const { matched, response } = await apiHandler.handle(request, {
    prefix: "/api",
    context: { request },
  });

  if (matched) return response;

  return Response.json({ code: "NOT_FOUND", message: "Not found" }, { status: 404 });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
