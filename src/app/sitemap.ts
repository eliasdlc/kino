import type { MetadataRoute } from "next";
import { LANDING_SEGMENTS } from "@/features/marketing/segments/segments.manifest";
import { SITE_URL } from "@/shared/lib/site-url";

/**
 * Sitemap del sitio público. Sólo lo que se quiere indexado: la landing, los
 * docs y una entrada por landing de arquetipo (D14) — generadas desde el
 * manifiesto de segmentos, así que un segmento nuevo entra al sitemap solo.
 * Todo lo autenticado queda fuera y bloqueado en `robots.ts`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-06");

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...LANDING_SEGMENTS.map((s) => ({
      url: `${SITE_URL}/para/${s.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/docs`, lastModified, changeFrequency: "monthly", priority: 0.7 },
  ];
}
