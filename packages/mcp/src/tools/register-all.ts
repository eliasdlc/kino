import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KinoFetch } from '../client.js';
import { registerContractTools } from './from-contract.js';
import { registerLearningTools } from './learning.js';

/**
 * Registra el set completo de tools de Kino sobre un servidor MCP, atado a un
 * fetcher concreto. Lo comparten el servidor stdio (fetcher por variables de
 * entorno) y la ruta HTTP remota (fetcher por token OAuth de cada petición), así
 * que los dos exponen exactamente la misma superficie.
 *
 * Las tools ya no se escriben: salen del contrato de la API. Ver
 * `from-contract.ts` y `catalog.ts`.
 *
 * La excepción son las tools compuestas, que no son un endpoint sino una
 * secuencia sobre varios. Van aparte y no en el catálogo, para que la regla de
 * arriba siga siendo cierta: el catálogo es exhaustivo sobre el contrato y nada
 * más. Hoy la única familia son las sesiones de aprendizaje.
 */
export function registerAllKinoTools(server: McpServer, kinoFetch: KinoFetch) {
  registerContractTools(server, kinoFetch);
  registerLearningTools(server, kinoFetch);
}
