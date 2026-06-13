import { systems } from "@/shared/db/schema";
import { z } from "zod";
import { createSystemSchema, updateSystemSchema } from "./systems.schemas";

export type System = typeof systems.$inferSelect;

/** System enriquecido con la señal `stale` para la lista de /systems. */
export type SystemWithSignals = System & {
  stale: boolean;
  daysSinceLastActivity: number | null;
  activeTaskCount: number;
};

export type CreateSystemInput = z.infer<typeof createSystemSchema>;

export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;