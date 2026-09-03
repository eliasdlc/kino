import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { stickyNotesContract } from "./sticky-notes.contract";
import {
  createStickyNote,
  deleteStickyNote,
  getStickyNotesByFolder,
  getStickyNotesByPage,
  stackStickyNotes,
  updateStickyNote,
} from "./sticky-notes.service";

const os = implement(stickyNotesContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const stickyNotesRouter = os.router({
  byPage: os.byPage.handler(({ context, input }) =>
    getStickyNotesByPage(input.pageId, context.userId),
  ),

  createOnPage: os.createOnPage.handler(({ context, input }) =>
    createStickyNote(context.userId, input),
  ),

  byFolder: os.byFolder.handler(({ context, input }) =>
    getStickyNotesByFolder(input.folderId, context.userId),
  ),

  createOnFolder: os.createOnFolder.handler(({ context, input }) =>
    createStickyNote(context.userId, input),
  ),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const updated = await updateStickyNote(id, context.userId, data);
    if (!updated) throw new NotFoundError("Note not found");
    return updated;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    const ok = await deleteStickyNote(input.id, context.userId);
    if (!ok) throw new NotFoundError("Note not found");
  }),

  stack: os.stack.handler(async ({ context, input }) => {
    const result = await stackStickyNotes(input.draggedId, input.targetId, context.userId);
    if (!result) throw new NotFoundError("Note not found");
    return result;
  }),
});
