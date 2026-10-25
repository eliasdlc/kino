import { describe, expect, it } from "vitest";
import { CLAUDE_ADD_CONNECTOR_URL, CLAUDE_CODE_COMMANDS, CODEX_COMMANDS, MCP_RESOURCE_URL } from "./connect";

describe("cómo se conecta cada asistente", () => {
  it("el enlace de claude.ai abre el diálogo de conector con la URL del recurso, sin perderla al codificar", () => {
    const url = new URL(CLAUDE_ADD_CONNECTOR_URL);
    expect(url.origin + url.pathname).toBe("https://claude.ai/customize/connectors");
    expect(url.searchParams.get("modal")).toBe("add-custom-connector");
    expect(url.searchParams.get("connectorName")).toBe("Kino");
    expect(url.searchParams.get("connectorUrl")).toBe(MCP_RESOURCE_URL);
  });

  it("Claude Code y Codex llevan el paso que autoriza, no sólo el que guarda la configuración", () => {
    for (const [add, login] of [CLAUDE_CODE_COMMANDS, CODEX_COMMANDS]) {
      expect(add).toContain(MCP_RESOURCE_URL);
      expect(login).toMatch(/^(claude|codex) mcp login kino$/);
    }
  });
});
