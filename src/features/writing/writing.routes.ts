import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import {
  closeWritingSession,
  getWorkJournal,
  getWritingOverview,
  setChapterCompleted,
} from "./writing.service";
import { getWorkStructure, searchStory } from "./writing.story";
import { getLooseThreads, setThreadResolved } from "./writing.chekhov";
import {
  getTimeline,
  reorderTimeline,
  unplaceFromTimeline,
} from "./writing.timeline";
import { getManuscript } from "./writing.manuscript";
import { applyPlotOperation, getPlotGrid } from "./writing.plot";
import { getSnapshot, listSnapshots, restoreSnapshot } from "./writing.snapshots";
import { getChapterSummary, getStudioReport } from "./writing.studio";

type IdParam = { id: string };

// GET /api/systems/[id]/writing: racha, meta diaria, ventana creativa, pulso de obras
export const getSystemWritingOverview = route<IdParam>()({}, async ({ userId, params }) => {
  const overview = await getWritingOverview(userId, params.id);
  if (!overview) throw new NotFoundError("System not found");
  return NextResponse.json(overview);
});

// GET /api/folders/[id]/journal: diario de la obra
export const getFolderJournal = route<IdParam>()({}, async ({ userId, params }) => {
  const journal = await getWorkJournal(userId, params.id);
  if (!journal) throw new NotFoundError("Work not found");
  return NextResponse.json(journal);
});

// GET /api/folders/[id]/structure: obra, capítulos y menciones (MCP)
export const getFolderStructure = route<IdParam>()({}, async ({ userId, params }) => {
  const structure = await getWorkStructure(userId, params.id);
  if (!structure) throw new NotFoundError("Work not found");
  return NextResponse.json(structure);
});

/**
 * Una `q` demasiado corta devuelve lista vacía, no 400: el buscador escribe
 * en la URL mientras tecleas y no puede pedir perdón en cada letra.
 */
const storySearchQuerySchema = z.object({
  q: z.string().trim().default(""),
});

// GET /api/systems/[id]/story-search?q=…  (MCP)
export const searchSystemStory = route<IdParam>()(
  { query: storySearchQuerySchema },
  async ({ userId, params, query }) => {
    if (query.q.length < 2) return NextResponse.json([]);
    return NextResponse.json(await searchStory(userId, params.id, query.q));
  },
);

// GET /api/folders/[id]/threads: hilos sueltos de la obra (Chekhov tracker)
export const getFolderThreads = route<IdParam>()({}, async ({ userId, params }) => {
  const report = await getLooseThreads(userId, params.id);
  if (!report) throw new NotFoundError("Work not found");
  return NextResponse.json(report);
});

const resolveThreadSchema = z.object({ resolved: z.boolean() });

// PATCH /api/entities/[id]/thread: cerrar o reabrir un hilo
export const patchEntityThread = route<IdParam>()(
  { body: resolveThreadSchema },
  async ({ userId, params, body }) => {
    const updated = await setThreadResolved(params.id, userId, body.resolved);
    if (!updated) throw new NotFoundError("Entity not found");
    return NextResponse.json(updated);
  },
);

// GET /api/folders/[id]/manuscript: la obra entera con el contenido (KIN-139)
export const getFolderManuscript = route<IdParam>()({}, async ({ userId, params }) => {
  const manuscript = await getManuscript(userId, params.id);
  if (!manuscript) throw new NotFoundError("Work not found");
  return NextResponse.json(manuscript);
});

// GET /api/folders/[id]/timeline: cronología in-world contra el orden narrado
export const getFolderTimeline = route<IdParam>()({}, async ({ userId, params }) => {
  const timeline = await getTimeline(userId, params.id);
  if (!timeline) throw new NotFoundError("Work not found");
  return NextResponse.json(timeline);
});

const reorderTimelineSchema = z.object({
  eventIds: z.array(z.string().uuid()).max(500),
});

// PUT /api/systems/[id]/timeline: reasignar el orden in-world de los eventos
export const putSystemTimeline = route<IdParam>()(
  { body: reorderTimelineSchema },
  async ({ userId, params, body }) =>
    NextResponse.json({ updated: await reorderTimeline(userId, params.id, body.eventIds) }),
);

// DELETE /api/entities/[id]/timeline: sacar un evento de la cronología
export const deleteEntityTimelinePlacement = route<IdParam>()({}, async ({ userId, params }) => {
  const ok = await unplaceFromTimeline(userId, params.id);
  if (!ok) throw new NotFoundError("Entity not found");
  return new NextResponse(null, { status: 204 });
});

// GET /api/folders/[id]/plot: escenas por capítulo y arco (KIN-141)
export const getFolderPlot = route<IdParam>()({}, async ({ userId, params }) => {
  const grid = await getPlotGrid(userId, params.id);
  if (!grid) throw new NotFoundError("Work not found");
  return NextResponse.json(grid);
});

const sceneIndex = z.number().int().min(0).max(2000);

const plotOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("move"),
    chapterId: z.string().uuid(),
    index: sceneIndex,
    toChapterId: z.string().uuid(),
    toIndex: sceneIndex,
    // Presente solo cuando el gesto también decide el arco (soltar en una celda).
    arc: z.string().trim().max(60).nullable().optional(),
  }),
  z.object({
    kind: z.literal("arc"),
    chapterId: z.string().uuid(),
    index: sceneIndex,
    arc: z.string().trim().max(60).nullable(),
  }),
]);

// PATCH /api/folders/[id]/plot: mover una escena o cambiarle el arco
export const patchFolderPlot = route<IdParam>()(
  { body: plotOperationSchema },
  async ({ userId, params, body }) => {
    const grid = await applyPlotOperation(userId, params.id, body);
    if (!grid) throw new NotFoundError("Work not found");
    return NextResponse.json(grid);
  },
);

// GET /api/pages/[id]/snapshots: historial del capítulo (KIN-142)
export const getPageSnapshots = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await listSnapshots(params.id, userId)),
);

// GET /api/snapshots/[id]: una versión con su texto
export const getPageSnapshot = route<IdParam>()({}, async ({ userId, params }) => {
  const snapshot = await getSnapshot(params.id, userId);
  if (!snapshot) throw new NotFoundError("Snapshot not found");
  return NextResponse.json(snapshot);
});

// POST /api/snapshots/[id]/restore: devolver el capítulo a esta versión
export const postSnapshotRestore = route<IdParam>()({}, async ({ userId, params }) => {
  const restored = await restoreSnapshot(params.id, userId);
  if (!restored) throw new NotFoundError("Snapshot not found");
  return NextResponse.json(restored);
});

// GET /api/systems/[id]/studio: qué escribir hoy y huecos del universo (KIN-143)
export const getSystemStudio = route<IdParam>()({}, async ({ userId, params }) => {
  const report = await getStudioReport(userId, params.id);
  if (!report) throw new NotFoundError("System not found");
  return NextResponse.json(report);
});

// GET /api/pages/[id]/summary: resumen extractivo del capítulo
export const getPageSummary = route<IdParam>()({}, async ({ userId, params }) => {
  const summary = await getChapterSummary(userId, params.id);
  if (!summary) throw new NotFoundError("Page not found");
  return NextResponse.json(summary);
});

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

const sessionSchema = z.object({
  startedAt: isoDate,
  endedAt: isoDate,
  durationMinutes: z.number().int().min(0).max(24 * 60),
});

// POST /api/pages/[id]/session: cerrar una sesión cronometrada de escritura
export const postPageWritingSession = route<IdParam>()(
  { body: sessionSchema },
  async ({ userId, params, body }) => {
    const result = await closeWritingSession({
      userId,
      pageId: params.id,
      startedAt: new Date(body.startedAt),
      endedAt: new Date(body.endedAt),
      durationMinutes: body.durationMinutes,
    });
    if (!result) throw new NotFoundError("Page not found");
    return NextResponse.json(result);
  },
);

const completeSchema = z.object({ completed: z.boolean() });

// PATCH /api/pages/[id]/complete: marcar capítulo terminado
export const patchPageCompletion = route<IdParam>()(
  { body: completeSchema },
  async ({ userId, params, body }) => {
    const updated = await setChapterCompleted(params.id, userId, body.completed);
    if (!updated) throw new NotFoundError("Page not found");
    return NextResponse.json(updated);
  },
);
