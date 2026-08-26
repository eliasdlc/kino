import { registerContractTools } from './from-contract.js';
/**
 * Registra el set completo de tools de Kino sobre un servidor MCP, atado a un
 * fetcher concreto. Lo comparten el servidor stdio (fetcher por variables de
 * entorno) y la ruta HTTP remota (fetcher por token OAuth de cada petición), así
 * que los dos exponen exactamente la misma superficie.
 *
 * Las tools ya no se escriben: salen del contrato de la API. Ver
 * `from-contract.ts` y `catalog.ts`.
 */
export function registerAllKinoTools(server, kinoFetch) {
    registerContractTools(server, kinoFetch);
}
