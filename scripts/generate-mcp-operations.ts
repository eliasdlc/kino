import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { apiContract } from "@/shared/api/contract.router";

/**
 * Vuelca el contrato en una tabla de operaciones que `packages/mcp` pueda leer.
 *
 * El paquete se publica en npm y no puede importar `src/`: la dependencia va en
 * el otro sentido (la app importa el paquete para servir `/api/mcp`). Por eso el
 * contrato viaja como código generado en vez de como import.
 *
 * Lo que cruza es la forma, no la prosa: método, ruta y el schema de entrada
 * como JSON Schema. Lo que el agente lee para decidir cuándo usar una tool
 * —su nombre y su descripción— sigue escrito a mano en el catálogo del paquete.
 *
 * Se regenera con `pnpm mcp:generate`, y el CI comprueba que lo commiteado
 * coincide con el contrato: un endpoint nuevo no puede llegar a producción sin
 * que alguien haya decidido si es una tool o no.
 */

interface Procedure {
  "~orpc": {
    route: { method?: string; path?: string };
    inputSchema?: z.ZodType;
  };
}

interface Operation {
  method: string;
  path: string;
  input: unknown;
}

export function collectOperations(): Record<string, Operation> {
  const operations: Record<string, Operation> = {};

  for (const [slice, contract] of Object.entries(apiContract)) {
    for (const [name, procedure] of Object.entries(contract as Record<string, Procedure>)) {
      const { route, inputSchema } = procedure["~orpc"];
      if (!route.method || !route.path) continue;

      operations[`${slice}.${name}`] = {
        method: route.method,
        path: route.path,
        // `io: "input"` describe lo que hay que mandar, no lo que sale del
        // parseo: es la diferencia entre `deleted?: string` y `deleted?: boolean`.
        // Los refinamientos no tienen forma en JSON Schema y se caen aquí; no
        // pasa nada, porque quien valida de verdad es el endpoint.
        input: inputSchema
          ? z.toJSONSchema(inputSchema, { io: "input", unrepresentable: "any" })
          : { type: "object", properties: {}, additionalProperties: false },
      };
    }
  }

  return operations;
}

/** El archivo tal como debe quedar. El test lo compara con el commiteado. */
export function renderOperationsFile(): string {
  const operations = collectOperations();
  const ids = Object.keys(operations).sort();

  return `// Generado por \`pnpm mcp:generate\`. No editar a mano.
//
// La forma de cada operación de la API de Kino, sacada del contrato. El nombre
// y la descripción de cada tool viven en \`catalog.ts\`, escritos para el agente.

export interface ContractOperation {
  readonly method: string;
  readonly path: string;
  readonly input: Record<string, unknown>;
}

export const OPERATIONS = ${JSON.stringify(
  Object.fromEntries(ids.map((id) => [id, operations[id]])),
  null,
  2,
)} as const satisfies Record<string, ContractOperation>;

/** Toda operación de la API. El catálogo tiene que decidir sobre cada una. */
export type OperationId = keyof typeof OPERATIONS;
`;
}

export const OPERATIONS_FILE = fileURLToPath(
  new URL("../packages/mcp/src/generated/operations.ts", import.meta.url),
);

// Sólo al ejecutarlo como script; el test importa las funciones de arriba.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  writeFileSync(OPERATIONS_FILE, renderOperationsFile());
  console.log(`${Object.keys(collectOperations()).length} operaciones → ${OPERATIONS_FILE}`);
}
