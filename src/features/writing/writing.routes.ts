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
