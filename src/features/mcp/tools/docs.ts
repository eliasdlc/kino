import { z } from "zod";
import { ALL_TOOLS } from "./index";
import type { Tool } from "./define";

/**
 * El documento de la API, generado del catálogo.
 *
 * **Se genera, no se escribe.** Un documento escrito a mano diverge del código
 * en la segunda semana, y este repo ya tiene un ejemplo de eso en `AGENTS.md`.
 *
 * Lo que publica es el contrato que un agente ve: el catálogo de tools, con el
 * perfil de credencial que cada una exige. Las funciones de Convex que no son
 * tool no aparecen, porque publicar una superficie que ninguna credencial
 * alcanza es peor que no publicar nada: manda a leer algo que no se puede usar.
 */

export interface ToolDocumentada {
  name: string;
  description: string;
  /** El alcance de credencial que hace falta: `read`, `propose` o `write`. */
  perfil: Tool["perfil"];
  /** La forma de la entrada, en JSON Schema. */
  input: unknown;
}

export interface DocumentoDeApi {
  producto: "Kino";
  /** Cómo se llega: un solo conector MCP remoto, sin claves propias. */
  conector: { transporte: "mcp"; ruta: "/api/mcp"; auth: "oauth-clerk" };
  /** Los ojos los pone tu agente: Kino no manda contenido a ningún modelo. */
  nota: string;
  tools: ToolDocumentada[];
}

/** La nota que acompaña al documento, para que nadie tenga que deducirla. */
export const NOTA =
  "Kino no manda contenido a ningún modelo. Las tools que devuelven una captura te la entregan para que la mires con tu propia clave; el análisis lo pones tú.";

export function documentoDeApi(tools: readonly Tool[] = ALL_TOOLS): DocumentoDeApi {
  return {
    producto: "Kino",
    conector: { transporte: "mcp", ruta: "/api/mcp", auth: "oauth-clerk" },
    nota: NOTA,
    tools: [...tools]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        perfil: tool.perfil,
        input: z.toJSONSchema(tool.input, { io: "input" }),
      })),
  };
}
