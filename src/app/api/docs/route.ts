import { NextResponse } from "next/server";
import { documentoDeApi } from "@/features/mcp/tools/docs";

/**
 * GET /api/docs: el contrato que un agente ve, generado del catálogo de tools.
 *
 * Público a propósito: es lo que alguien lee **antes** de conectar su agente,
 * cuando todavía no tiene credencial. No lleva datos de nadie, sólo nombres,
 * prosa y schemas de entrada.
 */
export async function GET() {
  return NextResponse.json(documentoDeApi(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
