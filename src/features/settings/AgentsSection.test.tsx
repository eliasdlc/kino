/**
 * Criterio: Ajustes explica cómo conectar cada agente, uno a la vez, con los
 * comandos de `features/mcp/connect` y sin nombrar "Codex" a solas, que en Kino
 * es el codex de entidades. Cada pestaña espera la primera llamada de su
 * cliente y deja de esperar sola cuando llega; la lista Conectados enseña los
 * que ya llamaron y desconecta uno sin confirmar.
 */
import { describe, expect, it, vi } from "vitest";

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
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

const HACE_4_MIN = () => Date.now() - 4 * 60_000;

/** Un Claude Code activo y un ChatGPT revocado, como en el mock. */
const conLista = (activos = true) =>
  makeTestConvexClient([
    stubQuery(api.mcpClients.list, {
      activos: activos
        ? [
            {
              _id: "m1" as Id<"mcpClients">,
              kind: "claude-code",
              label: "Claude Code",
              scope: "write",
              lastSeenAt: HACE_4_MIN(),
            },
          ]
        : [],
      revocados: activos
        ? [
            {
              _id: "m2" as Id<"mcpClients">,
              kind: "chatgpt",
              label: "ChatGPT",
              scope: "read",
              lastSeenAt: Date.now() - 86_400_000,
              revokedAt: Date.now() - 3_600_000,
            },
          ]
        : [],
    }),
  ]);

const esperando = (nombre: string) =>
  `Esperando la primera llamada de ${nombre}. Esta línea cambia sola cuando llegue.`;

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
    const { container } = renderWithProviders(<AgentsSection />, { convex: conLista() });

    for (const nombre of NOMBRES) {
      await user.click(screen.getByRole("tab", { name: nombre }));
      // Los comandos van en minúscula (`codex mcp add`): es el nombre del programa.
      expect(container.textContent).not.toMatch(/Codex(?! de OpenAI)/);
      expect(container.textContent).not.toMatch(/asistente/i);
    }
  });

  it("cada pestaña espera la primera llamada de su cliente mientras no ha llamado ninguno", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsSection />, { convex: conLista(false) });

    for (const nombre of NOMBRES) {
      await user.click(screen.getByRole("tab", { name: nombre }));
      expect(screen.getByText(esperando(nombre))).toBeVisible();
    }
    expect(screen.getByText("Todavía no ha llamado ninguno.")).toBeVisible();
  });

  it("mientras la lista carga no dice que espera", () => {
    renderWithProviders(<AgentsSection />);
    expect(screen.queryByText(/Esperando/)).toBeNull();
  });

  it("con un Claude Code conectado su pestaña deja de esperar y las demás siguen esperando", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsSection />, { convex: conLista() });

    expect(screen.queryByText(esperando("Claude Code"))).toBeNull();
    expect(
      screen.getByText("Última llamada de Claude Code hace 4 minutos. Lo ves en Conectados."),
    ).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Codex de OpenAI" }));
    expect(screen.getByText(esperando("Codex de OpenAI"))).toBeVisible();
  });

  it("si los de un cliente están todos desconectados, su pestaña espera una llamada nueva, no la primera", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentsSection />, { convex: conLista() });

    await user.click(screen.getByRole("tab", { name: "ChatGPT" }));
    expect(
      screen.getByText("Esperando una llamada nueva de ChatGPT. Esta línea cambia sola cuando llegue."),
    ).toBeVisible();
    expect(screen.queryByText(esperando("ChatGPT"))).toBeNull();
  });

  it("Conectados enseña el activo con Desconectar y el revocado sin botón", () => {
    renderWithProviders(<AgentsSection />, { convex: conLista() });
    const lista = within(screen.getByRole("region", { name: "Conectados" }));
    const [activo, revocado] = lista.getAllByRole("listitem");

    expect(within(activo).getByText("Claude Code")).toBeVisible();
    expect(within(activo).getByText("Escribir, última llamada hace 4 minutos")).toBeVisible();
    expect(within(activo).getByRole("button", { name: "Desconectar" })).toBeVisible();

    expect(within(revocado).getByText("ChatGPT")).toBeVisible();
    expect(within(revocado).getByText("Revocado")).toBeVisible();
    expect(within(revocado).getByText(/^Desconectado (hoy|ayer) a las? \d/)).toBeVisible();
    expect(within(revocado).queryByRole("button")).toBeNull();
  });

  it("Desconectar corta ese cliente sin confirmar y avisa qué recibe en su próxima llamada", async () => {
    vi.clearAllMocks();
    const user = userEvent.setup();
    const convex = conLista();
    renderWithProviders(<AgentsSection />, { convex });

    await user.click(screen.getByRole("button", { name: "Desconectar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(convex.calls).toContainEqual({
      kind: "mutation",
      name: "mcpClients:desconectar",
      args: { id: "m1" },
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Claude Code desconectado. Su próxima llamada recibe "acceso revocado desde Kino".',
    );
  });
});
