import { landingSurface } from "@/shared/lib/system-manifest";
import type { SystemMetadata } from "@/shared/lib/system-types";

/**
 * Las superficies de un sistema y con cuál abre. Sin "use client": la ruta lo
 * decide en el servidor y la cabecera y las superficies lo leen en el cliente.
 */
export type Surface = "tasks" | "docs";

/** La superficie que pide la URL, o la que el sistema abre por composición. */
export function surfaceOf(tab: string | null | undefined, landing: Surface): Surface {
  return tab === "docs" ? "docs" : tab === "tasks" ? "tasks" : landing;
}

/**
 * Con qué superficie abre un sistema. Escritura abre en sus manuscritos: es
 * el arquetipo cuyas páginas son lo primario. El resto, lo que diga su
 * composición.
 */
export function systemLanding(system: { templateType?: string | null; metadata?: SystemMetadata | null }): Surface {
  if (system.templateType === "writing") return "docs";
  return landingSurface(system);
}

/** Las superficies en el orden de las pestañas: la de entrada primero. */
export function systemSurfaces(landing: Surface): Surface[] {
  return landing === "docs" ? ["docs", "tasks"] : ["tasks", "docs"];
}
