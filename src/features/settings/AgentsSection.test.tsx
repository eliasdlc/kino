/**
 * Criterio: Ajustes explica cómo conectar cada agente, uno a la vez, con los
 * comandos de `features/mcp/connect` y sin nombrar "Codex" a solas, que en Kino
 * es el codex de entidades.
 */
import { describe, expect, it, vi } from "vitest";

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { renderWithProviders } from "@/shared/testing/render";
import {
  CLAUDE_ADD_CONNECTOR_URL,
  CLAUDE_CODE_COMMANDS,
  CODEX_COMMANDS,
} from "@/features/mcp/connect";
import { AgentsSection } from "./AgentsSection";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Una dirección que solo existe en el módulo compartido: si la sección pinta
// otra copia de la URL, no puede coincidir con esta.
const { DIRECCION_COMPARTIDA } = vi.hoisted(() => ({
  DIRECCION_COMPARTIDA: "https://compartida.invalid/api/mcp",
}));
vi.mock("@/features/mcp/connect", async (original) => ({
  ...(await original<typeof import("@/features/mcp/connect")>()),
  MCP_RESOURCE_URL: DIRECCION_COMPARTIDA,
}));

// Los comandos se pintan argumento por argumento, así que se buscan por el
// texto completo del <code> que los contiene.
const esComando = (comando: string) => (_: string, el: Element | null) =>
  el?.tagName === "CODE" && el.textContent === comando;

const NOMBRES = ["Claude", "Claude Code", "ChatGPT", "Codex de OpenAI"];

describe("AgentsSection", () => {
  it("ofrece una pestaña por cliente", () => {
    renderWithProviders(<AgentsSection />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(NOMBRES);
  });

  it("enseña un solo cliente a la vez y cambia con la pestaña", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsSection />);

    // Claude Code es el que se ve al entrar.
    expect(screen.getByText(esComando(CLAUDE_CODE_COMMANDS[0]))).toBeVisible();
    expect(screen.queryByText(esComando(CODEX_COMMANDS[0]))).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Codex de OpenAI" }));
    expect(screen.getByText(esComando(CODEX_COMMANDS[0]))).toBeVisible();
    expect(screen.getByText(esComando(CODEX_COMMANDS[1]))).toBeVisible();
    expect(screen.queryByText(esComando(CLAUDE_CODE_COMMANDS[0]))).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Claude" }));
    expect(screen.getByRole("link", { name: /Añadir Kino a Claude/ })).toHaveAttribute(
      "href",
      CLAUDE_ADD_CONNECTOR_URL,
    );
    expect(screen.queryByText(esComando(CODEX_COMMANDS[0]))).toBeNull();
  });

  it("Copiar los dos escribe los dos comandos del cliente en el portapapeles", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsSection />);

    await user.click(screen.getByRole("button", { name: "Copiar los dos" }));
    expect(await navigator.clipboard.readText()).toBe(CLAUDE_CODE_COMMANDS.join("\n"));

    await user.click(screen.getByRole("tab", { name: "Codex de OpenAI" }));
    await user.click(screen.getByRole("button", { name: "Copiar los dos" }));
    expect(await navigator.clipboard.readText()).toBe(CODEX_COMMANDS.join("\n"));
  });

  it("ChatGPT usa la misma dirección del conector que la documentación", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsSection />);

    await user.click(screen.getByRole("tab", { name: "ChatGPT" }));
    expect(screen.getByText(DIRECCION_COMPARTIDA)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Copiar la dirección" }));
    expect(await navigator.clipboard.readText()).toBe(DIRECCION_COMPARTIDA);
  });

  it("si el navegador niega el portapapeles, dice que se copie a mano", async () => {
    vi.clearAllMocks();
    const user = userEvent.setup();
    renderWithProviders(<AgentsSection />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new DOMException("Denegado", "NotAllowedError"),
    );

    await user.click(screen.getByRole("button", { name: "Copiar los dos" }));
    expect(toast.error).toHaveBeenCalledWith("No se pudo copiar. Selecciónalo y cópialo a mano.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("ningún texto dice Codex a solas ni asistente, en ninguna pestaña", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AgentsSection />);

    for (const nombre of NOMBRES) {
      await user.click(screen.getByRole("tab", { name: nombre }));
      // Los comandos van en minúscula (`codex mcp add`): es el nombre del programa.
      expect(container.textContent).not.toMatch(/Codex(?! de OpenAI)/);
      expect(container.textContent).not.toMatch(/asistente/i);
    }
  });
});
