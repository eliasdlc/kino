import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CATALOG } from "./catalog";
import { registerTools, type Call, type Tool } from "./define";
import { LEARNING_TOOLS } from "./learning";

/** Todo lo que el agente ve: el catálogo sobre Convex y las secuencias de aprendizaje. */
export const ALL_TOOLS: readonly Tool[] = [...CATALOG, ...LEARNING_TOOLS];

/**
 * Lo que el cliente lee al conectarse, antes de la primera tool. Está aquí
 * porque es lo único que hace que un agente mande su carpeta sin que se lo
 * pidan: la descripción de `create_task` lo repite para el agente que no lee
 * las instrucciones del servidor.
 */
export const SERVER_INSTRUCTIONS =
  "Kino organiza el trabajo de una persona en sistemas (una materia, un proyecto, un área). " +
  "Si trabajas en una carpeta local, como en Claude Code o en Codex de OpenAI, manda en create_task y en bulk_create_tasks tu carpeta de trabajo en workingDirectory, como ruta absoluta, " +
  "y si es un repo git la URL de su remoto origin en gitRemote. Hazlo siempre, sin esperar a que te lo pidan: Kino pone las tareas en el sistema que la persona asignó a esa carpeta. " +
  "Si la persona nombra un sistema, su systemId manda sobre la carpeta. " +
  "Si Kino responde needsSystem, la carpeta no tiene sistema: pregunta una sola vez a cuál va, crea las tareas con ese systemId y ofrece guardar la respuesta con save_workdir_rule. " +
  "Sin carpeta ni sistema, van a la Bandeja.";

export function registerAllTools(server: McpServer, call: Call): void {
  registerTools(server, call, ALL_TOOLS);
}
