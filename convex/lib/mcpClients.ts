// Los clientes del conector MCP que ya llamaron, vistos desde las dos orillas:
// Next (la ruta `/api/mcp` los registra) y Convex (`mcpClients.ts` los guarda).
// Comparten estas constantes y el mapa de nombres, como `mcpToken.ts`.

/**
 * El `sub` del token con el que la ruta de Next se presenta ante
 * `mcpClients.registrar`. Como `RATE_LIMIT_SUBJECT`, no es un id de Clerk, que
 * siempre empieza por `user_`: ninguna sesión ni ningún conector lo llevan.
 */
export const MCP_CLIENTS_SUBJECT = 'kino:mcp-clients';

/** Techo de clientes activos por persona. Al entrar el 31, sale el más antiguo. */
export const MCP_CLIENTS_ACTIVE_CAP = 30;

/**
 * Cuántos revocados enseña la lista, los más recientes. No se podan, pero solo
 * crecen cuando alguien pulsa Desconectar.
 */
export const MCP_CLIENTS_REVOCADOS_VISIBLES = 20;

/**
 * Cada cuánto como mucho se reescribe la fila de un cliente: una llamada
 * dentro de estos cinco minutos no escribe nada.
 */
export const REGISTRAR_CADA_MS = 5 * 60 * 1000;

/** La etiqueta de un cliente que no dijo su nombre. */
export const SIN_NOMBRE = 'Cliente sin nombre';

/** Lo más largo que se guarda de un nombre que Kino no reconoce. */
const NOMBRE_MAX = 60;

export type ClienteKind = 'claude' | 'claude-code' | 'chatgpt' | 'codex' | 'otro';

export type ClienteConocido = { kind: ClienteKind; label: string };

/**
 * Qué cliente es, a partir del `clientInfo.name` que manda en el protocolo.
 * Es una etiqueta para la pestaña y la lista, no una identidad: el nombre lo
 * declara el propio cliente.
 *
 * Codex se prueba primero y por `/codex/i`: su nombre real es
 * `codex-mcp-client` y nunca debe salir pelado en pantalla, solo como
 * «Codex de OpenAI». Los nombres de Claude Code y de Codex salen de clientes
 * reales (ver `mcpClients.test.ts`); los de claude.ai y ChatGPT son los más
 * probables y siguen sin captura.
 */
export function clienteConocido(name?: string): ClienteConocido {
  const nombre = name?.trim() ?? '';
  if (nombre === '') return { kind: 'otro', label: SIN_NOMBRE };
  if (/codex/i.test(nombre)) return { kind: 'codex', label: 'Codex de OpenAI' };
  if (/claude[-_ ]?code/i.test(nombre)) return { kind: 'claude-code', label: 'Claude Code' };
  if (/claude/i.test(nombre)) return { kind: 'claude', label: 'Claude (claude.ai)' };
  if (/chatgpt|openai/i.test(nombre)) return { kind: 'chatgpt', label: 'ChatGPT' };
  return { kind: 'otro', label: nombre.slice(0, NOMBRE_MAX).trim() };
}
