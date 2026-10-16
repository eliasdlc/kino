"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { CreateTagInput } from "./tags.schemas";

export function useTags(systemId: string) {
  return useConvexQuery(api.tags.bySystem, { systemId });
}

export function useCreateTag(systemId: string) {
  return useConvexMutation(api.tags.create, {
    map: (data: Omit<CreateTagInput, "systemId">) => ({ ...data, systemId }),
  });
}
