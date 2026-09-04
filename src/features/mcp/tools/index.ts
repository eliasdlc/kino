import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CATALOG } from "./catalog";
import { registerTools, type Call, type Tool } from "./define";
import { LEARNING_TOOLS } from "./learning";

/** Todo lo que el agente ve: el catálogo sobre Convex y las secuencias de aprendizaje. */
export const ALL_TOOLS: readonly Tool[] = [...CATALOG, ...LEARNING_TOOLS];

export function registerAllTools(server: McpServer, call: Call): void {
  registerTools(server, call, ALL_TOOLS);
}
