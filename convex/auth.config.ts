import type { AuthConfig } from 'convex/server';
import { MCP_TOKEN_ALGORITHM, MCP_TOKEN_AUDIENCE, MCP_TOKEN_ISSUER } from './lib/mcpToken';

// Dos emisores. Clerk, con la plantilla `convex`, para el navegador: el dominio
// es el emisor de la instancia (dev o producción) y vive como variable del
// deployment (`npx convex env set CLERK_JWT_ISSUER_DOMAIN https://...`).
//
// Y el conector MCP, que firma su propio token tras verificar el OAuth de Clerk
// (`convex/lib/mcpToken.ts`). Su clave pública entra como JWKS en un data URI:
// `npx convex env set KINO_MCP_JWKS 'data:application/json,...'`. Sin esa
// variable el provider no se registra y el conector recibe UNAUTHENTICATED.
const mcpJwks = process.env.KINO_MCP_JWKS;

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
    ...(mcpJwks
      ? [
          {
            type: 'customJwt' as const,
            issuer: MCP_TOKEN_ISSUER,
            jwks: mcpJwks,
            algorithm: MCP_TOKEN_ALGORITHM,
            applicationID: MCP_TOKEN_AUDIENCE,
          },
        ]
      : []),
  ],
} satisfies AuthConfig;
