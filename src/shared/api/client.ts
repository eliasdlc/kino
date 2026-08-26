import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { apiContract } from "./contract.router";

/**
 * El cliente tipado de la API.
 *
 * Los tipos salen del contrato, no de un cast: `api.tasks.byId({ id })` devuelve
 * lo que el contrato declara, y si esa declaración cambia, deja de compilar
 * aquí. Antes cada hook escribía la URL en texto y afirmaba la respuesta con
 * `res.json() as T`, así que un cambio en el servidor no rompía nada hasta el
 * navegador.
 *
 * Importa el contrato y no el router: el servidor no entra en el bundle.
 */
export const api: ContractRouterClient<typeof apiContract> = createORPCClient(
  new OpenAPILink(apiContract, {
    url: () => `${window.location.origin}/api`,
  }),
);
