import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** Una entidad del codex en lista, tal como llega al cliente. */
export type EntityListItem = FunctionReturnType<typeof api.entities.bySystem>[number];

/** La ficha entera: atributos, imágenes, relaciones y apariciones. */
export type EntityDetail = FunctionReturnType<typeof api.entities.byId>;

/** Relación resuelta hacia la otra entidad, lista para pintar en la ficha. */
export type EntityRelationItem = EntityDetail["relations"][number];

/** Un capítulo donde aparece la entidad, en orden de obra. */
export type EntityAppearance = EntityDetail["appearances"][number];

/** Entidad mencionada en un capítulo: alimenta el codex rail contextual. */
export type MentionedEntity = FunctionReturnType<typeof api.entities.byPage>[number];

export type EntityListItemTransport = EntityListItem;
export type EntityDetailTransport = EntityDetail;
export type EntityRelationItemTransport = EntityRelationItem;
export type MentionedEntityTransport = MentionedEntity;
