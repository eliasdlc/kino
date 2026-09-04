import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ALL_TOOLS } from "./index";

/**
 * El contrato visible del conector: los nombres que un agente ya tiene
 * aprendidos. Quitar uno rompe a quien lo usa; añadir uno es una decisión que
 * pasa por aquí.
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
  "create_energy_checkin",
  "create_entity",
  "create_folder",
  "create_folder_sticky_note",
  "create_learning_session",
  "create_page",
  "create_page_sticky_note",
  "create_system",
  "create_task",
  "delete_folder",
  "delete_page",
  "delete_sticky_note",
  "delete_system",
  "delete_task",
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
  "list_page_sticky_notes",
  "list_page_tasks",
  "list_pages",
  "list_systems",
  "list_tasks",
  "log_task_time",
  "move_task",
  "move_task_board",
  "park_learning_thought",
  "propose_day_blocks",
  "reorder_by_importance",
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
});
