import { systems } from "@/shared/db/schema";
import { z } from "zod";
import { createSystemSchema, updateSystemSchema } from "./systems.schemas";

export type System = typeof systems.$inferSelect;

export type CreateSystemInput = z.infer<typeof createSystemSchema>;

export type UpdateSystemInput = z.infer<typeof updateSystemSchema>;