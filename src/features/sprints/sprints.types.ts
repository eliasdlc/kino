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
