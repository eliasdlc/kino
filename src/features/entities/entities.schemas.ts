import { z } from "zod";
import { ENTITY_TYPES } from "./entities.attributes";

export const entityTypeSchema = z.enum(ENTITY_TYPES);

// `attributes` se valida aparte contra el manifiesto del `type` (parseEntityAttributes),
// porque su shape depende del tipo. Aquí solo aceptamos el saco crudo.
const rawAttributes = z.record(z.string(), z.unknown()).nullable().optional();

const aliases = z.array(z.string().trim().min(1).max(255)).max(50).optional();
const images = z.array(z.string().url().max(2048)).max(100).optional();

export const createEntitySchema = z.object({
  systemId: z.string(),
  type: entityTypeSchema,
  name: z.string().trim().min(1).max(255),
  aliases,
  summary: z.string().max(1000).nullable().optional(),
  attributes: rawAttributes,
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  images,
});

export const updateEntitySchema = z.object({
  type: entityTypeSchema.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  aliases,
  summary: z.string().max(1000).nullable().optional(),
  attributes: rawAttributes,
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  images,
});

export const createRelationSchema = z.object({
  toEntityId: z.string(),
  label: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type CreateRelationInput = z.infer<typeof createRelationSchema>;
