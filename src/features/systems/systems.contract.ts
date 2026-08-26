import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import {
  createSystemSchema,
  reorderSystemsSchema,
  updateSystemSchema,
} from "./systems.schemas";
import type { System, SystemWithSignals } from "./systems.types";

export const systemsContract = {
  list: endpoint
    .route({ method: "GET", path: "/systems" })
    .output(output<SystemWithSignals[]>()),

  create: endpoint
    .route({ method: "POST", path: "/systems", successStatus: 201 })
    .input(createSystemSchema)
    .output(output<System>()),

  update: endpoint
    .route({ method: "PATCH", path: "/systems/{id}" })
    .input(updateSystemSchema.extend({ id: z.string().uuid() }))
    .output(output<System>()),

  remove: endpoint
    .route({ method: "DELETE", path: "/systems/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),

  reorder: endpoint
    .route({ method: "POST", path: "/systems/reorder", successStatus: 204 })
    .input(reorderSystemsSchema)
    .output(noContent()),

  /**
   * Bootstrap posterior al registro: crea la bandeja de entrada. Sólo desde el
   * navegador — corre una vez, justo cuando todavía no existe ninguna clave API.
   */
  setup: endpoint
    .route({ method: "POST", path: "/users/setup" })
    .meta({ sessionOnly: true })
    .output(output<{ ok: true }>()),
};
