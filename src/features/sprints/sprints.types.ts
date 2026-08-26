import type { Transport } from "@/shared/api/transport";
import { sprints } from "@/shared/db/schema";

export type Sprint = typeof sprints.$inferSelect;

export type SprintListItem = Pick<
  Sprint,
  | "id"
  | "name"
  | "goal"
  | "startDate"
  | "endDate"
  | "status"
  | "completedAt"
  | "sortOrder"
  | "systemId"
>;

/** El sprint tal como llega al cliente: las fechas, en texto. */
export type SprintTransport = Transport<SprintListItem>;
