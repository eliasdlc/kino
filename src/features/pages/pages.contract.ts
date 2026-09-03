import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import type { ContextTagListItem } from "@/features/tags/tags.types";
import { createPageSchema, linkTaskSchema, updatePageSchema } from "./pages.schemas";
import type {
  LinkedTask,
  PageDetail,
  PageListItem,
  PageMutationResult,
} from "./pages.types";

/**
 * Las páginas. `/pages` con `systemId` en la query existe porque el MCP llega
 * por ahí; la UI usa la ruta anidada bajo el sistema.
 */
export const pagesContract = {
  bySystem: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/pages" })
    .input(z.object({ systemId: z.string().uuid() }))
    .output(output<PageListItem[]>()),

  createInSystem: endpoint
    .route({ method: "POST", path: "/systems/{systemId}/pages", successStatus: 201 })
    .input(createPageSchema.extend({ systemId: z.string().uuid() }))
    .output(output<PageListItem>()),

  list: endpoint
    .route({ method: "GET", path: "/pages" })
    .input(z.object({ systemId: z.string().min(1, "systemId is required") }))
    .output(output<PageListItem[]>()),

  create: endpoint
    .route({ method: "POST", path: "/pages", successStatus: 201 })
    .input(createPageSchema)
    .output(output<PageListItem>()),

  byId: endpoint
    .route({ method: "GET", path: "/pages/{id}" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<PageDetail>()),

  update: endpoint
    .route({ method: "PATCH", path: "/pages/{id}" })
    .input(updatePageSchema.extend({ id: z.string().uuid() }))
    .output(output<PageMutationResult>()),

  remove: endpoint
    .route({ method: "DELETE", path: "/pages/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),

  subpages: endpoint
    .route({ method: "GET", path: "/pages/{id}/subpages" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<PageListItem[]>()),

  createSubpage: endpoint
    .route({ method: "POST", path: "/pages/{id}/subpages", successStatus: 201 })
    .input(createPageSchema.extend({ id: z.string().uuid() }))
    .output(output<PageListItem>()),

  linkedTasks: endpoint
    .route({ method: "GET", path: "/pages/{id}/tasks" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<LinkedTask[]>()),

  linkTask: endpoint
    .route({ method: "POST", path: "/pages/{id}/tasks", successStatus: 204 })
    .input(linkTaskSchema.extend({ id: z.string().uuid() }))
    .output(noContent()),

  unlinkTask: endpoint
    .route({ method: "DELETE", path: "/pages/{id}/tasks/{taskId}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid(), taskId: z.string().uuid() }))
    .output(noContent()),

  tags: endpoint
    .route({ method: "GET", path: "/pages/{id}/tags" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<ContextTagListItem[]>()),

  addTag: endpoint
    .route({ method: "POST", path: "/pages/{id}/tags", successStatus: 204 })
    .input(z.object({ id: z.string().uuid(), tagId: z.string().uuid() }))
    .output(noContent()),

  removeTag: endpoint
    .route({ method: "DELETE", path: "/pages/{id}/tags/{tagId}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid(), tagId: z.string().uuid() }))
    .output(noContent()),
};
