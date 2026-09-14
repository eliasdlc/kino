"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";

/** Lo que espera confirmación y lo que caducó sin irse todavía. */
export function useCaptures() {
  return useConvexQuery(api.captures.pendientes, {});
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
