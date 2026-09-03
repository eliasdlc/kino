import type { Transport } from "@/shared/api/transport";
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

/** El sistema tal como llega al cliente: las fechas, en texto. */
export type SystemTransport = Transport<System>;

export type SystemWithSignalsTransport = Transport<SystemWithSignals>;

export type CreateSystemInput = z.infer<typeof createSystemSchema>;

export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;