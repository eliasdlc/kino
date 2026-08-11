import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/shared/utils/auth-context";
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
import { ForbiddenError } from "@/shared/utils/error";

const UNAUTHORIZED = { code: "UNAUTHORIZED", message: "Unauthorized" };

// GET /api/systems/[id]/writing — racha, meta diaria, ventana creativa, pulso de obras
export async function getSystemWritingOverview(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: systemId } = await params;
  const overview = await getWritingOverview(ctx.userId, systemId);
  if (!overview) {
    return NextResponse.json({ code: "NOT_FOUND", message: "System not found" }, { status: 404 });
  }
  return NextResponse.json(overview);
}

// GET /api/folders/[id]/journal — diario de la obra
export async function getFolderJournal(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: folderId } = await params;
  const journal = await getWorkJournal(ctx.userId, folderId);
  if (!journal) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Work not found" }, { status: 404 });
  }
  return NextResponse.json(journal);
}

// GET /api/folders/[id]/structure — obra → capítulos + menciones (MCP)
export async function getFolderStructure(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: folderId } = await params;
  const structure = await getWorkStructure(ctx.userId, folderId);
  if (!structure) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Work not found" }, { status: 404 });
  }
  return NextResponse.json(structure);
}

// GET /api/systems/[id]/story-search?q=… — búsqueda en el texto de las obras (MCP)
export async function searchSystemStory(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: systemId } = await params;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json([]);

  return NextResponse.json(await searchStory(ctx.userId, systemId, query));
}

// GET /api/folders/[id]/threads — hilos sueltos de la obra (Chekhov tracker)
export async function getFolderThreads(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: folderId } = await params;
  const report = await getLooseThreads(ctx.userId, folderId);
  if (!report) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Work not found" }, { status: 404 });
  }
  return NextResponse.json(report);
}

const resolveThreadSchema = z.object({ resolved: z.boolean() });

// PATCH /api/entities/[id]/thread — cerrar o reabrir un hilo
export async function patchEntityThread(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: entityId } = await params;
  const parsed = resolveThreadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await setThreadResolved(entityId, ctx.userId, parsed.data.resolved);
    if (!updated) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Entity not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ code: "FORBIDDEN", message: err.message }, { status: 403 });
    }
    throw err;
  }
}

// GET /api/folders/[id]/manuscript — la obra entera con el contenido (KIN-139)
export async function getFolderManuscript(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: folderId } = await params;
  const manuscript = await getManuscript(ctx.userId, folderId);
  if (!manuscript) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Work not found" }, { status: 404 });
  }
  return NextResponse.json(manuscript);
}

// GET /api/folders/[id]/timeline — cronología in-world contra el orden narrado
export async function getFolderTimeline(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: folderId } = await params;
  const timeline = await getTimeline(ctx.userId, folderId);
  if (!timeline) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Work not found" }, { status: 404 });
  }
  return NextResponse.json(timeline);
}

const reorderTimelineSchema = z.object({
  eventIds: z.array(z.string().uuid()).max(500),
});

// PUT /api/systems/[id]/timeline — reasignar el orden in-world de los eventos
export async function putSystemTimeline(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: systemId } = await params;
  const parsed = reorderTimelineSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await reorderTimeline(ctx.userId, systemId, parsed.data.eventIds);
    return NextResponse.json({ updated });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ code: "FORBIDDEN", message: err.message }, { status: 403 });
    }
    throw err;
  }
}

// DELETE /api/entities/[id]/timeline — sacar un evento de la cronología
export async function deleteEntityTimelinePlacement(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: entityId } = await params;
  const ok = await unplaceFromTimeline(ctx.userId, entityId);
  if (!ok) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Entity not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}

// GET /api/folders/[id]/plot — escenas por capítulo y arco (KIN-141)
export async function getFolderPlot(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: folderId } = await params;
  const grid = await getPlotGrid(ctx.userId, folderId);
  if (!grid) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Work not found" }, { status: 404 });
  }
  return NextResponse.json(grid);
}

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

// PATCH /api/folders/[id]/plot — mover una escena o cambiarle el arco
export async function patchFolderPlot(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: folderId } = await params;
  const parsed = plotOperationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const grid = await applyPlotOperation(ctx.userId, folderId, parsed.data);
  if (!grid) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Work not found" }, { status: 404 });
  }
  return NextResponse.json(grid);
}

// GET /api/pages/[id]/snapshots — historial del capítulo (KIN-142)
export async function getPageSnapshots(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: pageId } = await params;
  return NextResponse.json(await listSnapshots(pageId, ctx.userId));
}

// GET /api/snapshots/[id] — una versión con su texto
export async function getPageSnapshot(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id } = await params;
  const snapshot = await getSnapshot(id, ctx.userId);
  if (!snapshot) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Snapshot not found" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}

// POST /api/snapshots/[id]/restore — devolver el capítulo a esta versión
export async function postSnapshotRestore(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id } = await params;
  const restored = await restoreSnapshot(id, ctx.userId);
  if (!restored) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Snapshot not found" }, { status: 404 });
  }
  return NextResponse.json(restored);
}

// GET /api/systems/[id]/studio — qué escribir hoy y huecos del universo (KIN-143)
export async function getSystemStudio(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: systemId } = await params;
  const report = await getStudioReport(ctx.userId, systemId);
  if (!report) {
    return NextResponse.json({ code: "NOT_FOUND", message: "System not found" }, { status: 404 });
  }
  return NextResponse.json(report);
}

// GET /api/pages/[id]/summary — resumen extractivo del capítulo
export async function getPageSummary(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: pageId } = await params;
  const summary = await getChapterSummary(ctx.userId, pageId);
  if (!summary) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Page not found" }, { status: 404 });
  }
  return NextResponse.json(summary);
}

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

const sessionSchema = z.object({
  startedAt: isoDate,
  endedAt: isoDate,
  durationMinutes: z.number().int().min(0).max(24 * 60),
});

// POST /api/pages/[id]/session — cerrar una sesión cronometrada de escritura
export async function postPageWritingSession(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: pageId } = await params;
  const parsed = sessionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await closeWritingSession({
    userId: ctx.userId,
    pageId,
    startedAt: new Date(parsed.data.startedAt),
    endedAt: new Date(parsed.data.endedAt),
    durationMinutes: parsed.data.durationMinutes,
  });

  if (!result) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Page not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

const completeSchema = z.object({ completed: z.boolean() });

// PATCH /api/pages/[id]/complete — marcar capítulo terminado
export async function patchPageCompletion(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: pageId } = await params;
  const parsed = completeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await setChapterCompleted(pageId, ctx.userId, parsed.data.completed);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Page not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
