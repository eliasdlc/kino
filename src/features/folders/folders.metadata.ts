import { z } from "zod";
import {
  SYSTEM_TYPE_CONFIG,
  type ArchetypeFieldDef,
  type SystemType,
} from "@/shared/lib/system-types";

/**
 * Zod derivado del manifiesto: cada arquetipo declara los `fields` de su
 * folderRole (professor/horario/semestre en Academic, targetDate en
 * Entrepreneurial…) y de ahí sale el validador. Un arquetipo nuevo obtiene
 * validación sin tocar este archivo. Ver docs/DISENO-ARQUETIPOS-2026-07.md (D10).
 *
 * Todos los campos son opcionales (una clase puede no tener profesor cargado);
 * el schema es `.strict()` para rechazar claves fuera del manifiesto — metadata
 * no es un saco de basura.
 */
function fieldToZod(field: ArchetypeFieldDef): z.ZodTypeAny {
  switch (field.input) {
    case "number":
      // Los inputs HTML mandan strings ("50000"); coerce → number. Los vacíos ya
      // se descartan antes (stripEmpty), así que no colapsan a 0.
      return z.coerce.number().finite();
    case "date":
      // ISO date (YYYY-MM-DD) o timestamp parseable.
      return z
        .string()
        .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Fecha inválida" });
    case "text":
    default:
      return z.string().max(500);
  }
}

function buildSchema(fields: ArchetypeFieldDef[]): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.id] = fieldToZod(field).optional();
  }
  return z.object(shape).strict();
}

/** Cache de schemas por systemType (los manifiestos son constantes). */
const SCHEMA_BY_TYPE = new Map<SystemType, z.ZodObject<z.ZodRawShape>>();

export function folderMetadataSchema(systemType: SystemType): z.ZodObject<z.ZodRawShape> {
  const cached = SCHEMA_BY_TYPE.get(systemType);
  if (cached) return cached;
  const fields = SYSTEM_TYPE_CONFIG[systemType]?.folderRole?.fields ?? [];
  const schema = buildSchema(fields);
  SCHEMA_BY_TYPE.set(systemType, schema);
  return schema;
}

export type FolderMetadataParse =
  | { success: true; data: Record<string, unknown> | null }
  | { success: false; error: z.ZodError };

/**
 * Valida y normaliza la metadata entrante de un folder contra el manifiesto de
 * su arquetipo. Descarta valores vacíos (form manda "" en inputs no tocados) y
 * devuelve `null` si no queda nada — así no persistimos objetos vacíos.
 */
export function parseFolderMetadata(
  systemType: SystemType,
  raw: unknown,
): FolderMetadataParse {
  if (raw === null || raw === undefined) return { success: true, data: null };

  const cleaned = stripEmpty(raw);
  if (cleaned === null) return { success: true, data: null };

  const result = folderMetadataSchema(systemType).safeParse(cleaned);
  if (!result.success) return { success: false, error: result.error };

  const data = result.data as Record<string, unknown>;
  return { success: true, data: Object.keys(data).length === 0 ? null : data };
}

/** Quita strings vacíos/whitespace; devuelve null si el objeto queda vacío o no es objeto. */
function stripEmpty(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return Object.keys(out).length === 0 ? null : out;
}
