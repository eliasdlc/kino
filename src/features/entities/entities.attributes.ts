import { z } from "zod";

/**
 * Tipos de entidad del Codex. Debe coincidir con `entityTypeEnum` en schema.ts.
 */
export const ENTITY_TYPES = [
  "character",
  "location",
  "object",
  "concept",
  "event",
  "faction",
  "other",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityAttributeField {
  id: string;
  label: string;
  input: "text" | "textarea";
}

/**
 * Campos de `attributes` por tipo (PLAN-11 §5.1). Todo opcional — la ficha vacía
 * es válida; se enriquece después de crear la entidad desde el texto. La UI de la
 * ficha renderiza estos campos directamente desde el manifiesto, igual que el
 * folderRole de los arquetipos (folders.metadata.ts).
 */
export const ENTITY_ATTRIBUTE_FIELDS: Record<EntityType, EntityAttributeField[]> = {
  character: [
    { id: "role", label: "Rol", input: "text" },
    { id: "age", label: "Edad", input: "text" },
    { id: "origin", label: "Origen", input: "text" },
    { id: "appearance", label: "Apariencia", input: "textarea" },
    { id: "motivation", label: "Motivación", input: "textarea" },
  ],
  location: [
    { id: "region", label: "Región", input: "text" },
    { id: "description", label: "Descripción", input: "textarea" },
  ],
  object: [
    { id: "owner", label: "Poseedor", input: "text" },
    { id: "properties", label: "Propiedades", input: "textarea" },
  ],
  concept: [{ id: "description", label: "Descripción", input: "textarea" }],
  event: [
    { id: "when", label: "Cuándo (in-world)", input: "text" },
    { id: "what", label: "Qué pasó", input: "textarea" },
  ],
  faction: [
    { id: "leader", label: "Líder", input: "text" },
    { id: "description", label: "Descripción", input: "textarea" },
  ],
  other: [{ id: "description", label: "Descripción", input: "textarea" }],
};

/** Cache de schemas por tipo (los manifiestos son constantes). */
const SCHEMA_BY_TYPE = new Map<EntityType, z.ZodObject<z.ZodRawShape>>();

function buildSchema(fields: EntityAttributeField[]): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.id] = z.string().max(2000).optional();
  }
  // strict → rechaza claves fuera del manifiesto: attributes no es un saco.
  return z.object(shape).strict();
}

export function entityAttributesSchema(type: EntityType): z.ZodObject<z.ZodRawShape> {
  const cached = SCHEMA_BY_TYPE.get(type);
  if (cached) return cached;
  const schema = buildSchema(ENTITY_ATTRIBUTE_FIELDS[type] ?? []);
  SCHEMA_BY_TYPE.set(type, schema);
  return schema;
}

export type EntityAttributesParse =
  | { success: true; data: Record<string, string> | null }
  | { success: false; error: z.ZodError };

/** Quita strings vacíos/whitespace; null si el objeto queda vacío o no es objeto. */
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

/**
 * Valida y normaliza los `attributes` entrantes contra el manifiesto del tipo.
 * Descarta vacíos y devuelve `null` si no queda nada — no persistimos objetos
 * vacíos. Mismo contrato que parseFolderMetadata.
 */
export function parseEntityAttributes(
  type: EntityType,
  raw: unknown,
): EntityAttributesParse {
  if (raw === null || raw === undefined) return { success: true, data: null };

  const cleaned = stripEmpty(raw);
  if (cleaned === null) return { success: true, data: null };

  const result = entityAttributesSchema(type).safeParse(cleaned);
  if (!result.success) return { success: false, error: result.error };

  const data = result.data as Record<string, string>;
  return { success: true, data: Object.keys(data).length === 0 ? null : data };
}
