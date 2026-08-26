import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import type { getLooseThreads, setThreadResolved } from "./writing.chekhov";
import type { getManuscript } from "./writing.manuscript";
import type { applyPlotOperation, getPlotGrid } from "./writing.plot";
import type { getSnapshot, listSnapshots, restoreSnapshot } from "./writing.snapshots";
import type { getWorkStructure, searchStory } from "./writing.story";
import type { getChapterSummary, getStudioReport } from "./writing.studio";
import type { getTimeline } from "./writing.timeline";
import type {
  closeWritingSession,
  getWorkJournal,
  getWritingOverview,
  setChapterCompleted,
} from "./writing.service";

type Returns<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;
type Found<T extends (...args: never[]) => unknown> = NonNullable<Returns<T>>;

const idParam = z.object({ id: z.string().uuid() });
const sceneIndex = z.number().int().min(0).max(2000);

/**
 * Una `q` demasiado corta devuelve lista vacía, no 400: el buscador escribe en
 * la URL mientras tecleas y no puede pedir perdón en cada letra.
 */
const storySearchSchema = z.object({ q: z.string().trim().default("") });

const plotOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("move"),
    chapterId: z.string().uuid(),
    index: sceneIndex,
    toChapterId: z.string().uuid(),
    toIndex: sceneIndex,
    // Presente sólo cuando el gesto también decide el arco (soltar en una celda).
    arc: z.string().trim().max(60).nullable().optional(),
  }),
  z.object({
    kind: z.literal("arc"),
    chapterId: z.string().uuid(),
    index: sceneIndex,
    arc: z.string().trim().max(60).nullable(),
  }),
]);

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

export const writingContract = {
  overview: endpoint
    .route({ method: "GET", path: "/systems/{id}/writing" })
    .input(idParam)
    .output(output<Found<typeof getWritingOverview>>()),

  studio: endpoint
    .route({ method: "GET", path: "/systems/{id}/studio" })
    .input(idParam)
    .output(output<Found<typeof getStudioReport>>()),

  storySearch: endpoint
    .route({ method: "GET", path: "/systems/{id}/story-search" })
    .input(storySearchSchema.extend({ id: z.string().uuid() }))
    .output(output<Returns<typeof searchStory>>()),

  reorderTimeline: endpoint
    .route({ method: "PUT", path: "/systems/{id}/timeline" })
    .input(z.object({ id: z.string().uuid(), eventIds: z.array(z.string().uuid()).max(500) }))
    .output(output<{ updated: number }>()),

  journal: endpoint
    .route({ method: "GET", path: "/folders/{id}/journal" })
    .input(idParam)
    .output(output<Found<typeof getWorkJournal>>()),

  structure: endpoint
    .route({ method: "GET", path: "/folders/{id}/structure" })
    .input(idParam)
    .output(output<Found<typeof getWorkStructure>>()),

  threads: endpoint
    .route({ method: "GET", path: "/folders/{id}/threads" })
    .input(idParam)
    .output(output<Found<typeof getLooseThreads>>()),

  manuscript: endpoint
    .route({ method: "GET", path: "/folders/{id}/manuscript" })
    .input(idParam)
    .output(output<Found<typeof getManuscript>>()),

  timeline: endpoint
    .route({ method: "GET", path: "/folders/{id}/timeline" })
    .input(idParam)
    .output(output<Found<typeof getTimeline>>()),

  plot: endpoint
    .route({ method: "GET", path: "/folders/{id}/plot" })
    .input(idParam)
    .output(output<Found<typeof getPlotGrid>>()),

  applyPlotOperation: endpoint
    .route({ method: "PATCH", path: "/folders/{id}/plot" })
    .input(z.intersection(idParam, plotOperationSchema))
    .output(output<Found<typeof applyPlotOperation>>()),

  resolveThread: endpoint
    .route({ method: "PATCH", path: "/entities/{id}/thread" })
    .input(z.object({ id: z.string().uuid(), resolved: z.boolean() }))
    .output(output<Found<typeof setThreadResolved>>()),

  unplaceFromTimeline: endpoint
    .route({ method: "DELETE", path: "/entities/{id}/timeline", successStatus: 204 })
    .input(idParam)
    .output(noContent()),

  snapshots: endpoint
    .route({ method: "GET", path: "/pages/{id}/snapshots" })
    .input(idParam)
    .output(output<Returns<typeof listSnapshots>>()),

  snapshot: endpoint
    .route({ method: "GET", path: "/snapshots/{id}" })
    .input(idParam)
    .output(output<Found<typeof getSnapshot>>()),

  restoreSnapshot: endpoint
    .route({ method: "POST", path: "/snapshots/{id}/restore" })
    .input(idParam)
    .output(output<Found<typeof restoreSnapshot>>()),

  chapterSummary: endpoint
    .route({ method: "GET", path: "/pages/{id}/summary" })
    .input(idParam)
    .output(output<Found<typeof getChapterSummary>>()),

  closeSession: endpoint
    .route({ method: "POST", path: "/pages/{id}/session" })
    .input(
      z.object({
        id: z.string().uuid(),
        startedAt: isoDate,
        endedAt: isoDate,
        durationMinutes: z.number().int().min(0).max(24 * 60),
      }),
    )
    .output(output<Found<typeof closeWritingSession>>()),

  setCompleted: endpoint
    .route({ method: "PATCH", path: "/pages/{id}/complete" })
    .input(z.object({ id: z.string().uuid(), completed: z.boolean() }))
    .output(output<Found<typeof setChapterCompleted>>()),
};
