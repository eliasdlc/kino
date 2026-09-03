import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { tagsContract } from "./tags.contract";
import { createTag, deleteTag, getTagsBySystem, updateTag } from "./tags.service";

const os = implement(tagsContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const tagsRouter = os.router({
  bySystem: os.bySystem.handler(({ context, input }) =>
    getTagsBySystem(input.systemId, context.userId),
  ),

  create: os.create.handler(({ context, input }) => createTag(context.userId, input)),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const updated = await updateTag(id, context.userId, data);
    if (!updated) throw new NotFoundError("Tag not found");
    return updated;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    const ok = await deleteTag(input.id, context.userId);
    if (!ok) throw new NotFoundError("Tag not found");
  }),
});
