import type {
  EntityListItem,
  EntityDetail,
  MentionedEntity,
  EntityRelationItem,
} from "./entities.types";
import type { EntityAttributes, EntityType } from "./entities.attributes";
import type { UniverseGraph } from "./entities.graph";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? fallback);
  }
  return res.json();
}

export function fetchSystemEntities(systemId: string): Promise<EntityListItem[]> {
  return fetch(`/api/systems/${systemId}/entities`).then((r) =>
    jsonOrThrow(r, "Failed to fetch entities"),
  );
}

export function fetchUniverseGraph(systemId: string): Promise<UniverseGraph> {
  return fetch(`/api/systems/${systemId}/graph`).then((r) =>
    jsonOrThrow(r, "Failed to fetch universe graph"),
  );
}

export function fetchEntity(entityId: string): Promise<EntityDetail> {
  return fetch(`/api/entities/${entityId}`).then((r) =>
    jsonOrThrow(r, "Failed to fetch entity"),
  );
}

export function fetchPageEntities(pageId: string): Promise<MentionedEntity[]> {
  return fetch(`/api/pages/${pageId}/entities`).then((r) =>
    jsonOrThrow(r, "Failed to fetch page entities"),
  );
}

export interface CreateEntityBody {
  name: string;
  type: EntityType;
  aliases?: string[];
  summary?: string | null;
  attributes?: EntityAttributes | null;
  coverImageUrl?: string | null;
  images?: string[];
}

export function createEntityApi(
  systemId: string,
  body: CreateEntityBody,
): Promise<EntityListItem> {
  return fetch(`/api/systems/${systemId}/entities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => jsonOrThrow(r, "Failed to create entity"));
}

export function updateEntityApi(
  entityId: string,
  body: Partial<CreateEntityBody> & { type?: EntityType },
): Promise<EntityListItem> {
  return fetch(`/api/entities/${entityId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => jsonOrThrow(r, "Failed to update entity"));
}

export async function deleteEntityApi(entityId: string): Promise<void> {
  const res = await fetch(`/api/entities/${entityId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete entity");
}

export function createRelationApi(
  fromEntityId: string,
  body: { toEntityId: string; label?: string | null; notes?: string | null },
): Promise<EntityRelationItem> {
  return fetch(`/api/entities/${fromEntityId}/relations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => jsonOrThrow(r, "Failed to create relation"));
}

export async function deleteRelationApi(
  fromEntityId: string,
  relationId: string,
): Promise<void> {
  const res = await fetch(`/api/entities/${fromEntityId}/relations/${relationId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete relation");
}
