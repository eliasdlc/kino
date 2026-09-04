import { randomUUID } from "node:crypto";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it } from "vitest";
import { htmlToMarkdown } from "../markdown";
import type { Call } from "./define";
import { LEARNING_TOOLS } from "./learning";

/**
 * Estas tools valen por la secuencia, no por la llamada: leen la página, la
 * reescriben y la guardan contra una versión. Lo que puede romperse es el orden
 * y lo que se manda, así que Convex se simula con **sus mismas reglas**: guarda
 * HTML, mueve `updatedAt` en cada escritura y responde CONFLICT a una versión
 * vieja. Lo que se comprueba es lo que acaba escrito.
 */

interface StoredPage {
  id: string;
  title: string | null;
  content: string | null;
  updatedAt: string;
}

function fakeConvex() {
  const pages = new Map<string, StoredPage>();
  const notes: unknown[] = [];
  let clock = Date.parse("2026-08-28T04:00:00.000Z");
  const tick = () => new Date((clock += 1000)).toISOString();

  const call: Call = async (_kind, fn, rawArgs) => {
    const name = getFunctionName(fn);
    const args = rawArgs as Record<string, string | undefined>;

    if (name === "pages:create") {
      const page: StoredPage = { id: randomUUID(), title: args.title ?? null, content: args.content ?? null, updatedAt: tick() };
      pages.set(page.id, page);
      return page;
    }
    if (name === "stickyNotes:createOnPage") {
      const note = { id: `note-${notes.length + 1}`, ...args };
      notes.push(note);
      return note;
    }

    const page = args.id ? pages.get(args.id) : undefined;
    if (!page) throw new ConvexError({ code: "NOT_FOUND", message: "Page not found" });

    if (name === "pages:byId") return page;
    if (name === "pages:update") {
      if (args.expectedUpdatedAt && args.expectedUpdatedAt !== page.updatedAt) {
        throw new ConvexError({ code: "CONFLICT", message: "La página cambió después de leerla" });
      }
      page.content = args.content ?? page.content;
      page.updatedAt = tick();
      return page;
    }
    throw new Error(`función no simulada: ${name}`);
  };

  return { call, pages, notes };
}

let backend: ReturnType<typeof fakeConvex>;

const run = async (name: string, args: Record<string, unknown>) => {
  const tool = LEARNING_TOOLS.find((candidate) => candidate.name === name)!;
  return (await tool.run(backend.call, args)) as Record<string, string> & Record<string, never>;
};

const markdownDe = (pageId: string) => htmlToMarkdown(backend.pages.get(pageId)!.content);

const paso = {
  currentNodeId: "derivadas.cadena",
  lastUnderstood: "La derivada es una pendiente",
  nextAction: "Derivar sin(3x)",
  suggestedMinutes: 20,
};

async function nuevaSesion() {
  return run("create_learning_session", {
    systemId: "sys-1",
    topic: "Cálculo I",
    now: "Regla de la cadena",
    why: "Sale en el examen",
    ...paso,
  });
}

beforeEach(() => {
  backend = fakeConvex();
});

describe("sesiones de aprendizaje", () => {
  it("son cinco tools", () => {
    expect(LEARNING_TOOLS.map((tool) => tool.name)).toEqual([
      "create_learning_session",
      "get_learning_session",
      "save_learning_checkpoint",
      "append_learning_interaction",
      "park_learning_thought",
    ]);
  });

  it("se crea, se lee y se reanuda por donde iba", async () => {
    const creada = await nuevaSesion();
    const leida = await run("get_learning_session", { pageId: creada.pageId });

    expect(leida.contentFormat).toBe("markdown");
    expect(leida.content).toContain("## Ahora");
    expect(leida.checkpoint).toMatchObject(paso);
    expect(leida.resume).toMatchObject({ nextAction: "Derivar sin(3x)", suggestedMinutes: 20 });
    // La versión que devuelve la lectura es la que hay que guardar después.
    expect(leida.updatedAt).toBe(creada.updatedAt);
  });

  it("guardar el paso siguiente conserva el registro y el id de la sesión", async () => {
    const creada = await nuevaSesion();
    const conRegistro = await run("append_learning_interaction", {
      pageId: creada.pageId,
      expectedUpdatedAt: creada.updatedAt,
      kind: "probe",
      content: "Confundió producto con cadena",
    });

    const guardada = await run("save_learning_checkpoint", {
      pageId: creada.pageId,
      expectedUpdatedAt: conRegistro.updatedAt,
      now: "Regla del producto",
      why: "Es la que confundía",
      ...paso,
      currentNodeId: "derivadas.producto",
      nextAction: "Comparar las dos en un ejemplo",
    });

    const documento = markdownDe(creada.pageId)!;
    expect(documento).toContain("Confundió producto con cadena");
    expect(documento).toContain("Comparar las dos en un ejemplo");
    expect(documento).toContain("Regla del producto");
    // El id de sesión sobrevive a los guardados: es de la sesión, no del paso.
    expect(guardada.checkpoint).toMatchObject({
      sessionId: (creada.checkpoint as unknown as { sessionId: string }).sessionId,
      currentNodeId: "derivadas.producto",
    });
  });

  it("una escritura con la versión vieja no pisa nada", async () => {
    const creada = await nuevaSesion();
    const versionVieja = creada.updatedAt;
    await run("append_learning_interaction", {
      pageId: creada.pageId,
      expectedUpdatedAt: versionVieja,
      kind: "note",
      content: "Primera, la que se queda",
    });

    await expect(
      run("save_learning_checkpoint", {
        pageId: creada.pageId,
        expectedUpdatedAt: versionVieja,
        now: "Otra cosa",
        why: "Otra razón",
        ...paso,
      }),
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } });

    expect(markdownDe(creada.pageId)).toContain("Primera, la que se queda");
  });

  it("aparcar una idea no toca la sesión y devuelve dónde ibas", async () => {
    const creada = await nuevaSesion();

    const aparcada = await run("park_learning_thought", {
      pageId: creada.pageId,
      thought: "¿Esto sirve para la física?",
    });

    expect(backend.notes).toHaveLength(1);
    expect(aparcada.resume).toMatchObject({ nextAction: "Derivar sin(3x)" });
    // La página no se reescribe: su versión sigue siendo la de la creación.
    expect(backend.pages.get(creada.pageId)!.updatedAt).toBe(creada.updatedAt);
  });

  it("una página que no es una sesión lo dice claro", async () => {
    const sueltaId = randomUUID();
    backend.pages.set(sueltaId, {
      id: sueltaId,
      title: "Una nota",
      content: "<p>texto cualquiera</p>",
      updatedAt: "2026-08-28T04:00:00.000Z",
    });

    await expect(run("get_learning_session", { pageId: sueltaId })).rejects.toThrow(/sesión de aprendizaje/);
  });
});
