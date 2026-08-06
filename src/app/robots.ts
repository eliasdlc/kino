import type { MetadataRoute } from "next";
import { SITE_URL } from "@/shared/lib/site-url";

/**
 * Lo público se indexa; lo que hay detrás de sesión, no. Sin esto las landings
 * por arquetipo compartirían índice con pantallas que ningún buscador debería
 * intentar rastrear (y que sólo devolverían un redirect a /login).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/calendar",
        "/settings",
        "/systems",
        "/tasks",
        "/onboarding",
        "/consent",
        "/system-design",
        "/offline",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
