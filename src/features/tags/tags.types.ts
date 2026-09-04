import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type ContextTagListItem = FunctionReturnType<typeof api.tags.bySystem>[number];

export type ContextTag = ContextTagListItem;
