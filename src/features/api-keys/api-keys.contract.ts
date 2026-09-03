import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import { createApiKeySchema } from "./api-keys.schemas";
import type { generateApiKey, listApiKeys } from "./api-keys.service";

type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

/**
 * Emitir o revocar una clave usando una clave es escalada de privilegio, así
 * que todo este slice exige la sesión del navegador.
 */
const apiKey = endpoint.meta({ sessionOnly: true });

type CreatedKey = Returns<typeof generateApiKey>;

export const apiKeysContract = {
  list: apiKey
    .route({ method: "GET", path: "/api-keys" })
    .output(output<Returns<typeof listApiKeys>>()),

  /** El token en claro sale una sola vez, aquí. Después ya no existe. */
  create: apiKey
    .route({ method: "POST", path: "/api-keys", successStatus: 201 })
    .input(createApiKeySchema)
    .output(output<CreatedKey["record"] & { token: string }>()),

  remove: apiKey
    .route({ method: "DELETE", path: "/api-keys/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),

  /**
   * Revocar es la alternativa menos definitiva a borrar: la clave deja de
   * autenticar al instante pero la fila sigue en Ajustes, que es lo que quieres
   * cuando sospechas de una fuga y quieres registro de que existió.
   */
  revoke: apiKey
    .route({ method: "POST", path: "/api-keys/{id}/revoke", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),
};
