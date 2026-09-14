import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** Una captura tal como Bandeja la lee. El tipo sale de la propia query. */
export type CaptureItem = FunctionReturnType<typeof api.captures.pendientes>[number];

/** Lo que el agente propuso por cada cosa que leyó en la captura. */
export type ItemPropuesto = NonNullable<CaptureItem["proposedItems"]>[number];
