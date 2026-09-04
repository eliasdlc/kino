import type { AuthConfig } from 'convex/server';

// Convex valida el JWT que Clerk emite con la plantilla `convex`. El dominio
// es el emisor de la instancia (dev o producción) y vive como variable del
// deployment: `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://...`.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
