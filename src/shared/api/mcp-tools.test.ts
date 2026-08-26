import { describe, expect, it, vi } from "vitest";
import { registerAllKinoTools } from "@kino-app/mcp";

/**
 * Las tools del MCP, montadas de verdad sobre el contrato.
 *
 * Lo que se comprueba no es que existan sino que llaman a donde dicen: el
 * método, la URL con su hueco relleno, y dónde acaba cada parámetro —en la
 * query o en el cuerpo—. Eso es exactamente lo que antes se tecleaba a mano en
 * cada tool y era la tercera copia del contrato.
 */

interface Registered {
  description: string;
  schema: Record<string, unknown>;
  call: (input: Record<string, unknown>) => Promise<unknown>;
}

function mount() {
  const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
  const tools = new Map<string, Registered>();

  const server = {
    tool(
      name: string,
      description: string,
      schema: Record<string, unknown>,
      handler: (input: Record<string, unknown>) => Promise<unknown>,
    ) {
      tools.set(name, { description, schema, call: handler });
    },
  };

  const kinoFetch = vi.fn(async (path: string, options: RequestInit = {}) => {
    calls.push({
      path,
      method: options.method,
      body: options.body ? JSON.parse(String(options.body)) : undefined,
    });
    return { ok: true };
  });

  // El servidor real trae mucho más de lo que estas tools usan.
  registerAllKinoTools(server as never, kinoFetch as never);
  return { tools, calls };
}

const TASK_ID = "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
const SYSTEM_ID = "5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d";

describe("tools del MCP · superficie", () => {
  // 64 y no 62: el contrato distingue si una nota adhesiva cuelga de una página
  // o de una carpeta, así que las dos tools que preguntaban "una u otra" pasaron
  // a ser cuatro sin ambigüedad.
  it("registra las 64 tools del catálogo", () => {
    expect(mount().tools.size).toBe(64);
  });

  it("cada una llega con su descripción", () => {
    for (const [name, tool] of mount().tools) {
      expect(tool.description, name).toBeTruthy();
    }
  });
});

describe("tools del MCP · a dónde llaman", () => {
  it("una lectura con filtros los manda en la query", async () => {
    const { tools, calls } = mount();

    await tools.get("list_tasks")!.call({ systemId: SYSTEM_ID, status: "today" });

    expect(calls[0]).toMatchObject({ method: "GET" });
    expect(calls[0].path).toBe(`/api/tasks?systemId=${SYSTEM_ID}&status=today`);
  });

  it("un id de la ruta se sustituye y no viaja también en el cuerpo", async () => {
    const { tools, calls } = mount();

    await tools.get("update_task")!.call({ id: TASK_ID, title: "Nuevo título" });

    expect(calls[0]).toEqual({
      path: `/api/tasks/${TASK_ID}`,
      method: "PATCH",
      body: { title: "Nuevo título" },
    });
  });

  it("una ruta con dos huecos rellena los dos", async () => {
    const { tools, calls } = mount();

    await tools.get("list_folder_tasks")!.call({ systemId: SYSTEM_ID, folderId: TASK_ID });

    expect(calls[0].path).toBe(`/api/systems/${SYSTEM_ID}/folders/${TASK_ID}/tasks`);
  });

  it("borrar una tarea contesta con la frase de siempre, no con JSON", async () => {
    const { tools } = mount();

    const result = (await tools.get("delete_task")!.call({ id: TASK_ID })) as {
      content: Array<{ text: string }>;
    };

    expect(result.content[0].text).toBe(`Tarea ${TASK_ID} eliminada correctamente.`);
  });

  // El agente escribe markdown; la página guarda el HTML que el editor renderiza.
  it("el contenido de una página se convierte a HTML antes de mandarlo", async () => {
    const { tools, calls } = mount();

    await tools.get("create_page")!.call({ systemId: SYSTEM_ID, content: "# Título" });

    expect((calls[0].body as { content: string }).content).toContain("<h1");
  });

  // Dos tools sobre la misma operación: una lista y una recomendación.
  it("reorder_by_importance fija el límite y no se lo ofrece al agente", async () => {
    const { tools, calls } = mount();

    expect(Object.keys(tools.get("reorder_by_importance")!.schema)).not.toContain("limit");
    await tools.get("reorder_by_importance")!.call({});

    expect(calls[0].path).toBe("/api/insights/suggest?limit=10");
  });

  it("la validación de la entrada viene del contrato", () => {
    const { tools } = mount();

    expect(Object.keys(tools.get("create_task")!.schema).sort()).toContain("systemId");
    expect(Object.keys(tools.get("get_task")!.schema)).toEqual(["id"]);
  });
});
