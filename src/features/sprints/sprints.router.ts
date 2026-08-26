import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { sprintsContract } from "./sprints.contract";
import {
  closeSprint,
  createSprint,
  deleteSprint,
  getSprintsBySystem,
  updateSprint,
} from "./sprints.service";

const os = implement(sprintsContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const sprintsRouter = os.router({
  bySystem: os.bySystem.handler(({ context, input }) =>
    getSprintsBySystem(input.systemId, context.userId),
  ),

  create: os.create.handler(({ context, input }) => createSprint(context.userId, input)),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const updated = await updateSprint(id, context.userId, data);
    if (!updated) throw new NotFoundError("Sprint not found");
    return updated;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    const ok = await deleteSprint(input.id, context.userId);
    if (!ok) throw new NotFoundError("Sprint not found");
  }),

  close: os.close.handler(async ({ context, input }) => {
    const closed = await closeSprint(input.id, context.userId);
    if (!closed) throw new NotFoundError("Sprint not found");
    return closed;
  }),
});
