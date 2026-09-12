import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ALL_TOOLS } from "./index";

/**
 * El contrato visible del conector: los nombres que un agente ya tiene
 * aprendidos. Quitar uno rompe a quien lo usa; añadir uno es una decisión que
 * pasa por aquí.
 *
 * Son 68. Las seis que faltan respecto a la lista de antes se retiraron a
 * propósito y no vuelven sin reabrir el principio 2: las cinco de borrar,
 * `create_energy_checkin` (un check-in escrito por una máquina contamina el
 * único dato honesto que Kino tiene). `update_page` volvió con una política de
 * autoría original y confirmación explícita aplicada por el servidor.
 */
const CONTRACT = [
  "append_learning_interaction",
  "apply_weekly_ritual",
  "bulk_create_tasks",
  "bulk_move_tasks",
  "bulk_update_tasks",
  "classify_task",
  "clear_task_block",
  "complete_task",
  "create_entity",
  "create_folder",
  "create_folder_sticky_note",
  "create_learning_session",
  "create_page",
  "create_page_sticky_note",
  "create_system",
  "create_task",
  "detect_patterns",
  "estimate_task",
  "find_stale_systems",
  "generate_subtasks",
  "get_energy_checkin",
  "get_energy_distribution",
  "get_energy_windows",
  "get_entity",
  "get_folder_children",
  "get_learning_session",
  "get_page",
  "get_subtasks",
  "get_task",
  "get_timeline",
  "get_today_plan",
  "get_user_context",
  "get_weekly_ritual",
  "get_work_structure",
  "link_entities",
  "link_task_to_page",
  "list_entities",
  "list_folder_sticky_notes",
  "list_folder_tasks",
  "list_folders",
  "list_item_events",
  "list_page_sticky_notes",
  "list_page_tasks",
  "list_pages",
  "list_systems",
  "list_tasks",
  "log_task_time",
  "move_task",
  "move_task_board",
  "park_learning_thought",
  "propose_change",
  "propose_day_blocks",
  "reorder_by_importance",
  "restore_folder",
  "restore_page",
  "restore_sticky_note",
  "restore_task",
  "save_learning_checkpoint",
  "schedule_task_block",
  "search_story",
  "suggest_next_action",
  "unlink_task_from_page",
  "update_entity",
  "update_folder",
  "update_page",
  "update_sticky_note",
  "update_system",
  "update_task",
] as const;

describe("catálogo del MCP", () => {
  it("expone exactamente las tools del contrato, cada una una vez", () => {
    const names = ALL_TOOLS.map((tool) => tool.name).sort();
    expect(names).toEqual([...CONTRACT]);
  });

  it("cada tool tiene prosa para el agente y un schema que viaja como JSON Schema", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
      // Es lo que `tools/list` manda al cliente: un tipo sin forma en JSON
      // Schema (un `zid`, un `z.custom`) rompe la lista entera.
      expect(() => z.toJSONSchema(tool.input), tool.name).not.toThrow();
    }
  });

  it("update_page exige versión y limita la confirmación a la declaración acordada", () => {
    const update = ALL_TOOLS.find((tool) => tool.name === "update_page")!;

    expect(update.description).toContain("conversación actual");
    expect(update.description).toContain("no puede leer ni verificar");
    expect(update.input.safeParse({ id: "page" }).success).toBe(false);
    expect(
      update.input.safeParse({
        id: "page",
        expectedUpdatedAt: "2026-09-11T12:00:00.000Z",
        authorization: "el_agente_dice_que_si",
      }).success,
    ).toBe(false);
  });

  it("get_page conserva markdown y política sin exponer ids personales", async () => {
    const get = ALL_TOOLS.find((tool) => tool.name === "get_page")!;
    const call = vi.fn().mockResolvedValue({
      id: "page_1",
      userId: "user_1",
      clientRequestId: "request_1",
      title: "Apunte",
      content: "<h1>Título</h1><p>Texto</p>",
      createdVia: "oauth",
      agentEditPolicy: "direct",
      updatedAt: "2026-09-11T12:00:00.000Z",
    });

    const result = await get.run(call, { id: "page_1" });

    expect(result).toMatchObject({
      id: "page_1",
      content: "# Título\n\nTexto",
      contentFormat: "markdown",
      createdVia: "oauth",
      agentEditPolicy: "direct",
    });
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("clientRequestId");
  });

  it("update_page convierte markdown a HTML y devuelve markdown", async () => {
    const update = ALL_TOOLS.find((tool) => tool.name === "update_page")!;
    const call = vi.fn().mockResolvedValue({
      id: "page_1",
      title: "Apunte",
      content: "<h2>Actualizado</h2>",
      createdVia: "oauth",
      agentEditPolicy: "direct",
      updatedAt: "2026-09-11T12:01:00.000Z",
    });

    const result = await update.run(call, {
      id: "page_1",
      expectedUpdatedAt: "2026-09-11T12:00:00.000Z",
      content: "## Actualizado",
    });

    expect(call).toHaveBeenCalledOnce();
    expect(call.mock.calls[0]![0]).toBe("mutation");
    expect(call.mock.calls[0]![2]).toMatchObject({ content: "<h2>Actualizado</h2>\n" });
    expect(result).toMatchObject({ content: "## Actualizado", contentFormat: "markdown" });
  });
});
