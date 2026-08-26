/**
 * Datos del despliegue actual de Vercel que deciden si hay orígenes de preview
 * que añadir. En local y en producción todos vienen vacíos o con `env` distinto
 * de "preview", y la lista se queda como estaba.
 */
export type VercelDeployment = {
  /** `VERCEL_ENV`: "production", "preview" o "development". */
  env?: string;
  /** `VERCEL_BRANCH_URL`: estable por rama (`kino-git-<rama>-<equipo>.vercel.app`). */
  branchUrl?: string;
  /** `VERCEL_URL`: apunta a este despliegue concreto. */
  deploymentUrl?: string;
};

/** Vercel entrega los dominios sin esquema; Better Auth compara orígenes. */
function toOrigin(host: string | undefined): string | null {
  if (!host) return null;
  try {
    return new URL(host.includes("://") ? host : `https://${host}`).origin;
  } catch {
    return null;
  }
}

/**
 * Orígenes que Better Auth acepta como propios.
 *
 * `appUrl` es siempre el dominio público y `baseURL` no se mueve de ahí: de él
 * salen el `iss` de los tokens OAuth y las URLs de JWKS, que tienen que ser
 * deterministas. Lo que cambia en un preview es el dominio, así que se añade
 * aparte y sólo cuando el despliegue es un preview: producción no amplía nada.
 *
 * Se añaden las dos formas de llegar a un preview porque ambas se usan según
 * dónde se pulse el enlace: la de rama y la del despliegue concreto.
 *
 * Esto habilita entrar con correo, no el login social: Google y GitHub sólo
 * aceptan `redirect_uri` registrados y ese se construye desde `baseURL`.
 */
export function resolveTrustedOrigins(appUrl: string, vercel: VercelDeployment): string[] {
  const previewOrigins =
    vercel.env === "preview"
      ? [vercel.branchUrl, vercel.deploymentUrl].flatMap((host) => toOrigin(host) ?? [])
      : [];

  return [...new Set([appUrl, ...previewOrigins])];
}
