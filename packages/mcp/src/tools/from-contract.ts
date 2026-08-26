import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KinoFetch } from '../client.js';
import { OPERATIONS, type ContractOperation, type OperationId } from '../generated/operations.js';
import { CATALOG, type ToolSpec } from './catalog.js';

/**
 * Convierte el contrato de Kino en tools del MCP.
 *
 * Lo que antes se escribía tres veces —el schema Zod, la URL y el método— ahora
 * sale de `OPERATIONS`, que se genera del contrato que sirve la API. Lo único
 * escrito a mano es lo que el agente lee: el nombre y la descripción.
 *
 * La validación que se monta aquí es la primera línea, no la autoridad: los
 * refinamientos no tienen forma en JSON Schema y se quedan por el camino. Quien
 * decide sigue siendo el endpoint, que valida con el schema original.
 */

const PATH_PARAM = /\{\+?([^}]+)\}/g;

/** Los huecos de la ruta salen de la entrada; el resto va en query o en body. */
function pathParams(path: string): string[] {
  return [...path.matchAll(PATH_PARAM)].map(([, name]) => name);
}

function buildUrl(operation: ContractOperation, input: Record<string, unknown>) {
  const params = pathParams(operation.path);
  const path = operation.path.replace(PATH_PARAM, (_, name: string) =>
    encodeURIComponent(String(input[name] ?? '')),
  );

  const rest = Object.fromEntries(
    Object.entries(input).filter(([key, value]) => !params.includes(key) && value !== undefined),
  );

  if (operation.method !== 'GET' && operation.method !== 'DELETE') {
    return { url: `/api${path}`, body: rest };
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) query.set(key, String(value));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return { url: `/api${path}${suffix}`, body: undefined };
}

/** El schema de la entrada, sin los parámetros que la tool fija por su cuenta. */
function inputShape(operation: ContractOperation, spec: ToolSpec): z.ZodRawShape {
  const schema = z.fromJSONSchema(operation.input as Parameters<typeof z.fromJSONSchema>[0]);
  if (!(schema instanceof z.ZodObject)) return {};

  const shape: Record<string, z.ZodType> = {};
  for (const [name, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    if (spec.hiddenParams?.includes(name)) continue;
    const prose = spec.params?.[name];
    shape[name] = prose ? field.describe(prose) : field;
  }
  return shape;
}

function register(server: McpServer, kinoFetch: KinoFetch, id: OperationId, spec: ToolSpec) {
  const operation: ContractOperation = OPERATIONS[id];

  server.tool(spec.name, spec.description, inputShape(operation, spec), async (raw) => {
    const merged = { ...(raw as Record<string, unknown>), ...spec.fixedInput };
    const input = spec.prepareInput ? spec.prepareInput(merged) : merged;
    const { url, body } = buildUrl(operation, input);

    const result = await kinoFetch(url, {
      method: operation.method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = spec.confirmation
      ? spec.confirmation(input)
      : JSON.stringify(result ?? { ok: true }, null, 2);

    return { content: [{ type: 'text' as const, text }] };
  });
}

/** Registra una tool por cada operación que el catálogo expone. */
export function registerContractTools(server: McpServer, kinoFetch: KinoFetch) {
  for (const [id, entry] of Object.entries(CATALOG) as [OperationId, (typeof CATALOG)[OperationId]][]) {
    if (!entry) continue;
    for (const spec of Array.isArray(entry) ? entry : [entry]) {
      register(server, kinoFetch, id, spec);
    }
  }
}
