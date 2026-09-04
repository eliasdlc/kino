import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** El sprint tal como llega al cliente: las fechas, en texto. */
export type SprintListItem = FunctionReturnType<typeof api.sprints.bySystem>[number];

export type Sprint = SprintListItem;
export type SprintTransport = SprintListItem;
