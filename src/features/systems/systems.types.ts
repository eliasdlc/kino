import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { z } from "zod";
import { createSystemSchema, updateSystemSchema } from "./systems.schemas";

/** El sistema tal como llega al cliente: las fechas, en texto. */
export type System = FunctionReturnType<typeof api.systems.byId>;

/** Sistema enriquecido con sus señales para la lista de /systems. */
export type SystemWithSignals = FunctionReturnType<typeof api.systems.list>[number];

export type SystemTransport = System;

export type SystemWithSignalsTransport = SystemWithSignals;

export type CreateSystemInput = z.infer<typeof createSystemSchema>;

export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;
