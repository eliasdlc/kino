import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import { createFolderSchema, updateFolderSchema } from "./folders.schemas";
import type { FolderListItem, FolderWithCounts } from "./folders.types";

/**
 * Las carpetas. `metadata` entra como objeto laxo aquí a propósito: el validador
 * real está discriminado por el arquetipo del sistema dueño, y ese sólo se
 * conoce dentro del handler.
 */
export const foldersContract = {
  bySystem: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/folders" })
    .input(z.object({ systemId: z.string().uuid() }))
    .output(output<FolderWithCounts[]>()),

  create: endpoint
    .route({ method: "POST", path: "/systems/{systemId}/folders", successStatus: 201 })
    .input(createFolderSchema.extend({ systemId: z.string().uuid() }))
    .output(output<FolderListItem>()),

  children: endpoint
    .route({ method: "GET", path: "/folders/{id}/children" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<FolderWithCounts[]>()),

  update: endpoint
    .route({ method: "PATCH", path: "/folders/{id}" })
    .input(updateFolderSchema.extend({ id: z.string().uuid() }))
    .output(output<FolderListItem>()),

  remove: endpoint
    .route({ method: "DELETE", path: "/folders/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),
};
