"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { CaptureItem } from "./captures.types";

/**
 * Lo que espera confirmación y lo que caducó sin irse todavía. `initialData`
 * es lo que leyó el servidor de Bandeja: con él la lista llega entera en el
 * primer pintado y las capturas no entran después empujando a las tareas.
 */
export function useCaptures(initialData?: CaptureItem[]) {
  return useConvexQuery(api.captures.pendientes, {}, { initialData });
}

/** Crea la captura en el servidor con lo que el worker dejó en el teléfono. */
export function useCreateCapture() {
  return useConvexMutation(api.captures.crear);
}

/** El gesto: convierte en tareas los items marcados. */
export function useConfirmCapture() {
  return useConvexMutation(api.captures.confirmar);
}

export function useDiscardCapture() {
  return useConvexMutation(api.captures.descartar, { map: (id: string) => ({ id }) });
}
