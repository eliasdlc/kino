import { authServerMetadataHandlerClerk, metadataCorsOptionsRequestHandler } from "@clerk/mcp-tools/next";

// RFC 8414 en el dominio de Kino, para los clientes MCP que buscan el servidor
// OAuth aquí en vez de seguir la metadata del recurso. Reexpone la de Clerk.
export const GET = authServerMetadataHandlerClerk();
export const OPTIONS = metadataCorsOptionsRequestHandler();
