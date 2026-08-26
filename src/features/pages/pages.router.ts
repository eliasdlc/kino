import { implement, ORPCError } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { pagesContract } from "./pages.contract";
import {
  addTagToPage,
  createPage,
  deletePage,
  getLinkedTasks,
  getPageById,
  getPageTagsList,
  getPagesBySystem,
  getSubPages,
  linkTaskToPage,
  removeTagFromPage,
  unlinkTaskFromPage,
  updatePage,
} from "./pages.service";

const os = implement(pagesContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const pagesRouter = os.router({
  bySystem: os.bySystem.handler(({ context, input }) =>
    getPagesBySystem(input.systemId, context.userId),
  ),

  createInSystem: os.createInSystem.handler(({ context, input }) =>
    createPage(context.userId, input),
  ),

  list: os.list.handler(({ context, input }) => getPagesBySystem(input.systemId, context.userId)),

  create: os.create.handler(({ context, input }) => createPage(context.userId, input)),

  byId: os.byId.handler(async ({ context, input }) => {
    const page = await getPageById(input.id, context.userId);
    if (!page) throw new NotFoundError("Page not found");
    return page;
  }),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const updated = await updatePage(id, context.userId, data);
    if (!updated) throw new NotFoundError("Page not found");
    return updated;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    const ok = await deletePage(input.id, context.userId);
    if (!ok) throw new NotFoundError("Page not found");
  }),

  subpages: os.subpages.handler(({ context, input }) => getSubPages(input.id, context.userId)),

  createSubpage: os.createSubpage.handler(({ context, input }) => {
    const { id, ...data } = input;
    return createPage(context.userId, { ...data, parentPageId: id });
  }),

  linkedTasks: os.linkedTasks.handler(({ context, input }) =>
    getLinkedTasks(input.id, context.userId),
  ),

  linkTask: os.linkTask.handler(async ({ context, input }) => {
    const newlyLinked = await linkTaskToPage(input.id, input.taskId, context.userId);
    if (!newlyLinked) {
      // 409 y no un error de dominio: enlazar dos veces no es una validación
      // rota ni un recurso ausente, y el cliente lo distingue por el code.
      throw new ORPCError("CONFLICT", {
        status: 409,
        message: "Task is already linked to this page",
      });
    }
  }),

  unlinkTask: os.unlinkTask.handler(async ({ context, input }) => {
    try {
      await unlinkTaskFromPage(input.id, input.taskId, context.userId);
    } catch {
      // Desenlazar algo que no existe se ha respondido siempre como 404, sin
      // distinguir cuál de los dos falta.
      throw new NotFoundError("Page not found");
    }
  }),

  tags: os.tags.handler(({ context, input }) => getPageTagsList(input.id, context.userId)),

  addTag: os.addTag.handler(async ({ context, input }) => {
    await addTagToPage(input.id, input.tagId, context.userId);
  }),

  removeTag: os.removeTag.handler(async ({ context, input }) => {
    await removeTagFromPage(input.id, input.tagId, context.userId);
  }),
});
