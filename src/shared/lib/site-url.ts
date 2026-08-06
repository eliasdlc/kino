/**
 * URL pública del sitio. Misma variable que usan auth y el MCP — no se inventa
 * una segunda fuente. Sirve de `metadataBase` para que los canonical y las
 * etiquetas OpenGraph de las páginas públicas salgan absolutas.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
