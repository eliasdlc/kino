import type { EntityType } from "./entities.attributes";

export interface EntityListItem {
  id: string;
  systemId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  summary: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Relación resuelta hacia la otra entidad, lista para pintar en la ficha. */
export interface EntityRelationItem {
  id: string;
  label: string | null;
  notes: string | null;
  /** La entidad al otro extremo de la relación (siempre la que no es la ficha actual). */
  other: { id: string; name: string; type: EntityType };
  /** true si la ficha actual es el `from` (dirección de la relación). */
  outgoing: boolean;
}

/** Un capítulo donde aparece la entidad, en orden de obra. */
export interface EntityAppearance {
  pageId: string;
  pageTitle: string | null;
  mentionCount: number;
}

export interface EntityDetail extends EntityListItem {
  attributes: Record<string, string> | null;
  images: string[];
  relations: EntityRelationItem[];
  appearances: EntityAppearance[];
}

/** Entidad mencionada en un capítulo — alimenta el codex rail contextual. */
export interface MentionedEntity {
  id: string;
  name: string;
  type: EntityType;
  summary: string | null;
  coverImageUrl: string | null;
  mentionCount: number;
}
