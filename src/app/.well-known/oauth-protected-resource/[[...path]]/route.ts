import { corsHeaders, generateClerkProtectedResourceMetadata } from "@clerk/mcp-tools/server";
import { MCP_OAUTH_SCOPES, MCP_RESOURCE_URL } from "@/features/mcp/auth";

/**
 * RFC 9728: le dice a un cliente MCP qué servidor OAuth protege `/api/mcp`.
 * Es la instancia de Clerk, derivada de la clave publicable. Se sirve en la
 * raíz y en la variante con la ruta del recurso
 * (`/.well-known/oauth-protected-resource/api/mcp`), que es la que anuncia el
 * 401 de la ruta y la primera que prueban los clientes nuevos.
 */
export function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return new Response("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", { status: 500 });
  const metadata = generateClerkProtectedResourceMetadata({
    publishableKey,
    resourceUrl: MCP_RESOURCE_URL,
    properties: { scopes_supported: [...MCP_OAUTH_SCOPES] },
  });
  return Response.json(metadata, { headers: { ...corsHeaders, "Cache-Control": "max-age=3600" } });
}

export function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}
