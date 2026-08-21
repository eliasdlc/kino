import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import { createPageSchema, updatePageSchema, linkTaskSchema } from "./pages.schemas";
import {
  getPagesBySystem,
  createPage,
  getPageById,
  updatePage,
  deletePage,
  linkTaskToPage,
  unlinkTaskFromPage,
  getLinkedTasks,
} from "./pages.service";

type IdParam = { id: string };

// GET/POST /api/systems/[id]/pages
export const getSystemPages = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await getPagesBySystem(params.id, userId)),
);

export const createSystemPage = route<IdParam>()(
  {
    body: createPageSchema,
    // `systemId` viaja en la URL, no en el body, pero el schema lo exige.
    prepareBody: (raw, params) => ({ ...(raw as object), systemId: params.id }),
  },
  async ({ userId, body }) => NextResponse.json(await createPage(userId, body), { status: 201 }),
);

// GET/PATCH/DELETE /api/pages/[id]
export const getPage = route<IdParam>()({}, async ({ userId, params }) => {
  const page = await getPageById(params.id, userId);
  if (!page) throw new NotFoundError("Page not found");
  return NextResponse.json(page);
});

export const patchPage = route<IdParam>()(
  { body: updatePageSchema },
  async ({ userId, params, body }) => {
    const updated = await updatePage(params.id, userId, body);
    if (!updated) throw new NotFoundError("Page not found");
    return NextResponse.json(updated);
  },
);

export const removePage = route<IdParam>()({}, async ({ userId, params }) => {
  const ok = await deletePage(params.id, userId);
  if (!ok) throw new NotFoundError("Page not found");
  return new NextResponse(null, { status: 204 });
});

// GET/POST /api/pages/[id]/tasks  (linked tasks)
export const getPageTasks = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await getLinkedTasks(params.id, userId)),
);

export const linkPageTask = route<IdParam>()(
  { body: linkTaskSchema },
  async ({ userId, params, body }) => {
    const newlyLinked = await linkTaskToPage(params.id, body.taskId, userId);
    if (!newlyLinked) {
      // 409 y no un error del wrapper: enlazar dos veces no es un fallo de
      // validación ni un recurso ausente, y el cliente lo distingue por el code.
      return NextResponse.json(
        { code: "CONFLICT", message: "Task is already linked to this page" },
        { status: 409 },
      );
    }
    return new NextResponse(null, { status: 204 });
  },
);

// DELETE /api/pages/[id]/tasks/[taskId]
export const unlinkPageTask = route<{ id: string; taskId: string }>()(
  {},
  async ({ userId, params }) => {
    try {
      await unlinkTaskFromPage(params.id, params.taskId, userId);
    } catch {
      // Desenlazar algo que no existe se ha respondido siempre como 404, sin
      // distinguir qué de los dos falta.
      throw new NotFoundError("Page not found");
    }
    return new NextResponse(null, { status: 204 });
  },
);

// GET /api/pages?systemId=  (alcanzable por el MCP)
export const listPagesForMcp = route()(
  { query: z.object({ systemId: z.string().min(1, "systemId is required") }) },
  async ({ userId, query }) => NextResponse.json(await getPagesBySystem(query.systemId, userId)),
);

// POST /api/pages  (alcanzable por el MCP)
export const createPageDirect = route()({ body: createPageSchema }, async ({ userId, body }) =>
  NextResponse.json(await createPage(userId, body), { status: 201 }),
);
