"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { CreateSprintInput, UpdateSprintInput } from "./sprints.schemas";

export function useSprints(systemId: string, options?: { enabled?: boolean }) {
  return useConvexQuery(api.sprints.bySystem, { systemId }, options);
}

export function useCreateSprint(systemId: string) {
  return useConvexMutation(api.sprints.create, {
    map: (data: Omit<CreateSprintInput, "systemId">) => ({ ...data, systemId }),
  });
}

export function useUpdateSprint(_systemId: string) {
  return useConvexMutation(api.sprints.update, {
    map: ({ sprintId, data }: { sprintId: string; data: UpdateSprintInput }) => ({ id: sprintId, ...data }),
  });
}

export function useCloseSprint(_systemId: string) {
  return useConvexMutation(api.sprints.close, { map: (sprintId: string) => ({ id: sprintId }) });
}

export function useDeleteSprint(_systemId: string) {
  return useConvexMutation(api.sprints.remove, { map: (sprintId: string) => ({ id: sprintId }) });
}
