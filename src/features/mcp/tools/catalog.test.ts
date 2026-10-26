import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getFunctionName } from "convex/server";
import { SIN_TOOL } from "./catalog";
import { ALL_TOOLS, SERVER_INSTRUCTIONS } from "./index";

/**
 * El contrato visible del conector: los nombres que un agente ya tiene
 * aprendidos. Quitar uno rompe a quien lo usa; añadir uno es una decisión que
 * pasa por aquí.
 *
 * Son 72. Tres son los ojos prestados: `list_captures` lista lo que espera por
 * fuente, `get_capture` entrega la captura para que el agente la mire con su
 * clave y `resolve_capture` recibe lo que leyó, sin crear nada. Las seis que faltan respecto a la lista de antes se
 * retiraron a propósito y no vuelven sin reabrir el principio 2: las cinco de
 * borrar,
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
  "get_capture",
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
  "list_captures",
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
  "resolve_capture",
  "restore_folder",
  "restore_page",
  "restore_sticky_note",
  "restore_task",
  "save_learning_checkpoint",
  "save_workdir_rule",
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

describe("create_task y la carpeta del agente", () => {
  const create = ALL_TOOLS.find((tool) => tool.name === "create_task")!;

  it("manda la carpeta y el remoto a Convex, y el sistema ya no es obligatorio", async () => {
    const call = vi.fn().mockResolvedValue({ status: "created", routedBy: "rule", rule: { kind: "path", key: "/home/ana/U", systemName: "Universidad" }, task: { id: "task_1", systemId: "sys_u" } });

    await create.run(call, { title: "Leer", workingDirectory: "/home/ana/U", gitRemote: "git@github.com:ana/u.git" });

    expect(getFunctionName(call.mock.calls[0]![1])).toBe("tasks:createFromAgent");
    expect(call.mock.calls[0]![2]).toMatchObject({ title: "Leer", workingDirectory: "/home/ana/U", gitRemote: "git@github.com:ana/u.git" });
  });

  it("con regla, devuelve la tarea y qué regla la puso ahí", async () => {
    const call = vi.fn().mockResolvedValue({ status: "created", routedBy: "rule", rule: { kind: "path", key: "/home/ana/U", systemName: "Universidad" }, task: { id: "task_1", systemId: "sys_u" } });

    const result = await create.run(call, { title: "Leer", workingDirectory: "/home/ana/U" });

    expect(result).toEqual({ id: "task_1", systemId: "sys_u", routedBy: "rule", rule: { kind: "path", key: "/home/ana/U", systemName: "Universidad" } });
  });

  it("sin regla, le dice al agente que pregunte una vez y ofrezca guardar la respuesta", async () => {
    const call = vi.fn().mockResolvedValue({ status: "needs_system", workingDirectory: "/home/ana/nueva", gitRemote: null });

    const result = (await create.run(call, { title: "Leer", workingDirectory: "/home/ana/nueva" })) as Record<string, unknown>;

    expect(result).toMatchObject({ created: false, needsSystem: true, workingDirectory: "/home/ana/nueva", gitRemote: null });
    expect(result.next).toContain("una sola vez");
    expect(result.next).toContain("save_workdir_rule");
  });

  it("las instrucciones del servidor y la descripción piden la carpeta sin que nadie la pida", () => {
    expect(SERVER_INSTRUCTIONS).toContain("workingDirectory");
    expect(SERVER_INSTRUCTIONS).toContain("sin esperar a que te lo pidan");
    expect(create.description).toContain("manda SIEMPRE workingDirectory");
  });
});

describe("bulk_create_tasks y la carpeta del agente", () => {
  const bulk = ALL_TOOLS.find((tool) => tool.name === "bulk_create_tasks")!;
  const rule = { kind: "path", key: "/home/ana/U", systemName: "Universidad" };

  it("manda la carpeta y el remoto del lote a Convex, y el sistema de cada tarea ya no es obligatorio", async () => {
    const call = vi.fn().mockResolvedValue({ status: "created", routedBy: "rule", rule, tasks: [] });

    await bulk.run(call, { tasks: [{ title: "Uno" }, { title: "Dos" }], workingDirectory: "/home/ana/U", gitRemote: "git@github.com:ana/u.git" });

    expect(getFunctionName(call.mock.calls[0]![1])).toBe("tasks:bulkCreate");
    expect(call.mock.calls[0]![2]).toMatchObject({ tasks: [{ title: "Uno" }, { title: "Dos" }], workingDirectory: "/home/ana/U", gitRemote: "git@github.com:ana/u.git" });
  });

  it("con regla, devuelve las tareas y qué regla las puso ahí", async () => {
    const tasks = [{ id: "task_1", systemId: "sys_u" }];
    const call = vi.fn().mockResolvedValue({ status: "created", routedBy: "rule", rule, tasks });

    const result = await bulk.run(call, { tasks: [{ title: "Uno" }], workingDirectory: "/home/ana/U" });

    expect(result).toEqual({ routedBy: "rule", rule, tasks });
  });

  it("sin regla, le dice al agente que pregunte una vez y vuelva a llamar a bulk_create_tasks", async () => {
    const call = vi.fn().mockResolvedValue({ status: "needs_system", workingDirectory: "/home/ana/nueva", gitRemote: null });

    const result = (await bulk.run(call, { tasks: [{ title: "Uno" }], workingDirectory: "/home/ana/nueva" })) as Record<string, unknown>;

    expect(result).toMatchObject({ created: false, needsSystem: true, workingDirectory: "/home/ana/nueva", gitRemote: null });
    expect(result.next).toContain("una sola vez");
    expect(result.next).toContain("bulk_create_tasks");
    expect(result.next).toContain("save_workdir_rule");
  });

  it("la descripción y las instrucciones del servidor piden la carpeta también aquí", () => {
    expect(bulk.description).toContain("manda SIEMPRE workingDirectory");
    expect(SERVER_INSTRUCTIONS).toContain("bulk_create_tasks");
  });
});

/** El nombre `modulo:funcion` de la función de Convex que hay detrás. */
function nombreDeFuncion(ref: (typeof ALL_TOOLS)[number]["ref"]): string {
  return ref ? getFunctionName(ref) : "";
}

describe("lo que existe y no se expone", () => {
  it("del slice de capturas sólo salen los ojos prestados y su lista, y ninguna escritura", () => {
    const deCapturas = ALL_TOOLS.filter((tool) => nombreDeFuncion(tool.ref).startsWith("captures:"));

    expect(deCapturas.map((tool) => nombreDeFuncion(tool.ref)).sort()).toEqual([
      "captures:entregar",
      "captures:porFuente",
      "captures:resolver",
    ]);
  });

  it("confirmar no es una tool: el gesto es de una persona", () => {
    const nombres = ALL_TOOLS.map((tool) => nombreDeFuncion(tool.ref));

    expect(nombres).not.toContain("captures:confirmar");
    expect(nombres).not.toContain("captures:descartar");
    expect(nombres).not.toContain("captures:crear");
  });

  it("las cinco están clasificadas: decidir no exponerlas es una decisión escrita", () => {
    expect(SIN_TOOL).toEqual([
      "captures:crear",
      "captures:confirmar",
      "captures:descartar",
      "captures:pendientes",
      "systems:radiografia",
    ]);
  });

  it("la radiografía no es una tool: el agente mira las filas, no un resumen redactado", () => {
    expect(ALL_TOOLS.map((tool) => nombreDeFuncion(tool.ref))).not.toContain("systems:radiografia");
  });
});

describe("create_page y la carpeta del agente", () => {
  const create = ALL_TOOLS.find((tool) => tool.name === "create_page")!;

  it("llama a pages:createFromAgent con la carpeta y sin exigir el sistema", async () => {
    const call = vi.fn().mockResolvedValue({ status: "created", routedBy: "rule", rule: { kind: "path", key: "/home/ana/U", systemName: "Universidad" }, page: { id: "page_1", systemId: "sys_u" } });

    const result = await create.run(call, { title: "Apuntes", content: "hola", workingDirectory: "/home/ana/U" });

    expect(getFunctionName(call.mock.calls[0]![1])).toBe("pages:createFromAgent");
    expect(call.mock.calls[0]![2]).toMatchObject({ title: "Apuntes", workingDirectory: "/home/ana/U" });
    expect(result).toEqual({ id: "page_1", systemId: "sys_u", routedBy: "rule", rule: { kind: "path", key: "/home/ana/U", systemName: "Universidad" } });
  });

  it("sin regla, le dice al agente que pregunte una vez y vuelva a llamar a create_page", async () => {
    const call = vi.fn().mockResolvedValue({ status: "needs_system", workingDirectory: "/home/ana/nueva", gitRemote: null });

    const result = (await create.run(call, { title: "Apuntes", workingDirectory: "/home/ana/nueva" })) as Record<string, unknown>;

    expect(result).toMatchObject({ created: false, needsSystem: true, workingDirectory: "/home/ana/nueva" });
    expect(String(result.next)).toContain("create_page");
    expect(String(result.next)).toContain("save_workdir_rule");
  });
});
