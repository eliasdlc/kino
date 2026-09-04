/**
 * A dónde volver después de entrar. Sólo rutas propias: un `next` con dominio
 * convertiría el login en un redirector abierto.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
