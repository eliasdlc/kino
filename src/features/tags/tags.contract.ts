import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import { createTagSchema, updateTagSchema } from "./tags.schemas";
import type { ContextTagListItem } from "./tags.types";

/**
 * Los tags de contexto. `systemId` viaja en la URL y el schema de creación ya lo
 * declara, así que el contrato no necesita el `prepareBody` que la ruta hacía
 * a mano para mezclarlos.
 */
export const tagsContract = {
  bySystem: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/tags" })
    .input(z.object({ systemId: z.string().uuid() }))
    .output(output<ContextTagListItem[]>()),

  create: endpoint
    .route({ method: "POST", path: "/systems/{systemId}/tags", successStatus: 201 })
    .input(createTagSchema.extend({ systemId: z.string().uuid() }))
    .output(output<ContextTagListItem>()),

  update: endpoint
    .route({ method: "PATCH", path: "/tags/{id}" })
    .input(updateTagSchema.extend({ id: z.string().uuid() }))
    .output(output<ContextTagListItem>()),

  remove: endpoint
    .route({ method: "DELETE", path: "/tags/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),
};
