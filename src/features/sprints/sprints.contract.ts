import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import { createSprintSchema, updateSprintSchema } from "./sprints.schemas";
import type { SprintListItem } from "./sprints.types";

export const sprintsContract = {
  bySystem: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/sprints" })
    .input(z.object({ systemId: z.string().uuid() }))
    .output(output<SprintListItem[]>()),

  create: endpoint
    .route({ method: "POST", path: "/systems/{systemId}/sprints", successStatus: 201 })
    .input(createSprintSchema.extend({ systemId: z.string().uuid() }))
    .output(output<SprintListItem>()),

  update: endpoint
    .route({ method: "PATCH", path: "/sprints/{id}" })
    .input(updateSprintSchema.extend({ id: z.string().uuid() }))
    .output(output<SprintListItem>()),

  remove: endpoint
    .route({ method: "DELETE", path: "/sprints/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),

  close: endpoint
    .route({ method: "POST", path: "/sprints/{id}/close" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<SprintListItem>()),
};
