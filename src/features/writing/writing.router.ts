import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { writingContract } from "./writing.contract";
import { getLooseThreads, setThreadResolved } from "./writing.chekhov";
import { getManuscript } from "./writing.manuscript";
import { applyPlotOperation, getPlotGrid } from "./writing.plot";
import { getSnapshot, listSnapshots, restoreSnapshot } from "./writing.snapshots";
import { getWorkStructure, searchStory } from "./writing.story";
import { getChapterSummary, getStudioReport } from "./writing.studio";
import { getTimeline, reorderTimeline, unplaceFromTimeline } from "./writing.timeline";
import {
  closeWritingSession,
  getWorkJournal,
  getWritingOverview,
  setChapterCompleted,
} from "./writing.service";

const os = implement(writingContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

/** Casi todo este slice cuelga de una obra o de un capítulo que puede no ser tuyo. */
function found<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new NotFoundError(message);
  return value;
}

export const writingRouter = os.router({
  overview: os.overview.handler(async ({ context, input }) =>
    found(await getWritingOverview(context.userId, input.id), "System not found"),
  ),

  studio: os.studio.handler(async ({ context, input }) =>
    found(await getStudioReport(context.userId, input.id), "System not found"),
  ),

  storySearch: os.storySearch.handler(({ context, input }) =>
    input.q.length < 2 ? [] : searchStory(context.userId, input.id, input.q),
  ),

  reorderTimeline: os.reorderTimeline.handler(async ({ context, input }) => ({
    updated: await reorderTimeline(context.userId, input.id, input.eventIds),
  })),

  journal: os.journal.handler(async ({ context, input }) =>
    found(await getWorkJournal(context.userId, input.id), "Work not found"),
  ),

  structure: os.structure.handler(async ({ context, input }) =>
    found(await getWorkStructure(context.userId, input.id), "Work not found"),
  ),

  threads: os.threads.handler(async ({ context, input }) =>
    found(await getLooseThreads(context.userId, input.id), "Work not found"),
  ),

  manuscript: os.manuscript.handler(async ({ context, input }) =>
    found(await getManuscript(context.userId, input.id), "Work not found"),
  ),

  timeline: os.timeline.handler(async ({ context, input }) =>
    found(await getTimeline(context.userId, input.id), "Work not found"),
  ),

  plot: os.plot.handler(async ({ context, input }) =>
    found(await getPlotGrid(context.userId, input.id), "Work not found"),
  ),

  applyPlotOperation: os.applyPlotOperation.handler(async ({ context, input }) => {
    const { id, ...operation } = input;
    return found(await applyPlotOperation(context.userId, id, operation), "Work not found");
  }),

  resolveThread: os.resolveThread.handler(async ({ context, input }) =>
    found(await setThreadResolved(input.id, context.userId, input.resolved), "Entity not found"),
  ),

  unplaceFromTimeline: os.unplaceFromTimeline.handler(async ({ context, input }) => {
    const ok = await unplaceFromTimeline(context.userId, input.id);
    if (!ok) throw new NotFoundError("Entity not found");
  }),

  snapshots: os.snapshots.handler(({ context, input }) => listSnapshots(input.id, context.userId)),

  snapshot: os.snapshot.handler(async ({ context, input }) =>
    found(await getSnapshot(input.id, context.userId), "Snapshot not found"),
  ),

  restoreSnapshot: os.restoreSnapshot.handler(async ({ context, input }) =>
    found(await restoreSnapshot(input.id, context.userId), "Snapshot not found"),
  ),

  chapterSummary: os.chapterSummary.handler(async ({ context, input }) =>
    found(await getChapterSummary(context.userId, input.id), "Page not found"),
  ),

  closeSession: os.closeSession.handler(async ({ context, input }) =>
    found(
      await closeWritingSession({
        userId: context.userId,
        pageId: input.id,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        durationMinutes: input.durationMinutes,
      }),
      "Page not found",
    ),
  ),

  setCompleted: os.setCompleted.handler(async ({ context, input }) =>
    found(await setChapterCompleted(input.id, context.userId, input.completed), "Page not found"),
  ),
});
