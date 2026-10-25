import { SITE_URL } from "@/shared/lib/site-url";

/**
 * Cómo se conecta cada agente al conector remoto. No importa nada de servidor,
 * para que la doc pública y la app puedan leerlo en el navegador.
 */

/** El recurso que protege el OAuth. Es la URL que el cliente configura. */
export const MCP_RESOURCE_URL = `${SITE_URL}/api/mcp`;

/** El nombre con el que el conector aparece en el cliente. */
export const MCP_SERVER_NAME = "kino";

/**
 * El enlace que abre en claude.ai el diálogo de conector personalizado con el
 * nombre y la URL ya puestos; la persona revisa y confirma. Lo documenta
 * Anthropic en claude.com/docs/connectors/building/directory-vs-custom.
 */
export const CLAUDE_ADD_CONNECTOR_URL = `https://claude.ai/customize/connectors?${new URLSearchParams({
  modal: "add-custom-connector",
  connectorName: "Kino",
  connectorUrl: MCP_RESOURCE_URL,
})}`;

/**
 * Los dos comandos de cada CLI. El primero sólo guarda la configuración; el
 * segundo abre el navegador para autorizar. Sin el segundo el cliente se queda
 * en "Needs authentication" y parece que no pasó nada. Claude Code guarda por
 * defecto el servidor sólo para la carpeta donde se añadió; con `--scope user`
 * Kino está en todas.
 */
export const CLAUDE_CODE_COMMANDS = [
  `claude mcp add --scope user --transport http ${MCP_SERVER_NAME} ${MCP_RESOURCE_URL}`,
  `claude mcp login ${MCP_SERVER_NAME}`,
] as const;

export const CODEX_COMMANDS = [
  `codex mcp add ${MCP_SERVER_NAME} --url ${MCP_RESOURCE_URL}`,
  `codex mcp login ${MCP_SERVER_NAME}`,
] as const;
