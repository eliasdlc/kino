import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";

/** Ids de kind válidos que declara el manifiesto para un arquetipo. */
export function validTaskKinds(systemType: SystemType): string[] {
  return (SYSTEM_TYPE_CONFIG[systemType]?.taskKinds ?? []).map((k) => k.id);
}

/**
 * Valida la capa semántica `metadata.kind` contra los taskKinds del arquetipo
 * (D11). Solo mira la clave `kind`; el resto de metadata (course, eventSubtype,
 * generateStudyPlan…) sigue siendo passthrough laxo. Un kind que el manifiesto
 * no declara se rechaza — metadata no es un saco.
 *
 * Devuelve un mensaje de error si es inválido, o null si está OK (incluye el
 * caso sin kind).
 */
export function validateTaskKind(
  systemType: SystemType,
  metadata: unknown,
): string | null {
  if (metadata === null || typeof metadata !== "object") return null;
  const kind = (metadata as Record<string, unknown>).kind;
  if (kind === undefined || kind === null) return null;
  if (typeof kind !== "string") return "task kind must be a string";

  const allowed = validTaskKinds(systemType);
  if (allowed.length === 0) {
    return `El arquetipo "${systemType}" no define tipos de tarea (kinds).`;
  }
  if (!allowed.includes(kind)) {
    return `Kind "${kind}" inválido para ${systemType}. Válidos: ${allowed.join(", ")}.`;
  }
  return null;
}
