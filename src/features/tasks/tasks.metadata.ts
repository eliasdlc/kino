import type { ArchetypeManifest } from "@/shared/lib/system-types";

/** Ids de kind válidos según el manifiesto EFECTIVO del sistema. */
export function validTaskKinds(manifest: ArchetypeManifest): string[] {
  return manifest.taskKinds.map((k) => k.id);
}

/**
 * Valida la capa semántica `metadata.kind` contra los taskKinds del sistema
 * (D11). Solo mira la clave `kind`; el resto de metadata (course, eventSubtype,
 * generateStudyPlan…) sigue siendo passthrough laxo. Un kind que el manifiesto
 * no declara se rechaza: metadata no es un saco.
 *
 * Recibe el manifiesto ya resuelto y no el systemType porque un sistema `custom`
 * puede haber compuesto sus propios kinds (D16): el arquetipo solo no alcanza
 * para saber qué es válido.
 *
 * Devuelve un mensaje de error si es inválido, o null si está OK (incluye el
 * caso sin kind).
 */
export function validateTaskKind(
  manifest: ArchetypeManifest,
  metadata: unknown,
): string | null {
  if (metadata === null || typeof metadata !== "object") return null;
  const kind = (metadata as Record<string, unknown>).kind;
  if (kind === undefined || kind === null) return null;
  if (typeof kind !== "string") return "task kind must be a string";

  const allowed = validTaskKinds(manifest);
  if (allowed.length === 0) {
    return `Este sistema no define tipos de tarea (kinds).`;
  }
  if (!allowed.includes(kind)) {
    return `Kind "${kind}" inválido para este sistema. Válidos: ${allowed.join(", ")}.`;
  }
  return null;
}
