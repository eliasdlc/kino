import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/api/handler";

/**
 * La puerta de las rutas que ya se sirven desde el contrato.
 *
 * Es un catch-all a propósito: Next resuelve antes cualquier `route.ts` más
 * específico, así que aquí sólo llega lo que ningún archivo reclama. Migrar un
 * slice es borrar sus `route.ts` y añadir su contrato al router; mientras tanto,
 * los veintisiete que faltan siguen sirviéndose como siempre.
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
