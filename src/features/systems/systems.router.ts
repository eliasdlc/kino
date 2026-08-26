import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { systemsContract } from "./systems.contract";
import {
  assertNotInbox,
  createInboxForUser,
  createSystem,
  deactivateSystem,
  getSystemById,
  getUsersSystems,
  reorderSystem,
  updateSystem,
} from "./systems.service";

const os = implement(systemsContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const systemsRouter = os.router({
  list: os.list.handler(async ({ context }) => {
    await createInboxForUser(context.userId);
    return getUsersSystems(context.userId);
  }),

  create: os.create.handler(({ context, input }) => createSystem(context.userId, input)),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const current = await getSystemById(id, context.userId);
    if (!current) throw new NotFoundError("System not found");

    await assertNotInbox(current);

    // `metadata` es una bolsa compartida (tabs, composición, meta de palabras):
    // un PATCH que sólo toca una clave no puede borrar las demás. `null`
    // explícito sigue significando "vacía la bolsa".
    const patch =
      data.metadata == null
        ? data
        : { ...data, metadata: { ...(current.metadata ?? {}), ...data.metadata } };

    const updated = await updateSystem(id, context.userId, patch);
    if (!updated) throw new NotFoundError("System not found");
    return updated;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    await deactivateSystem(input.id, context.userId);
  }),

  reorder: os.reorder.handler(async ({ context, input }) => {
    await reorderSystem(context.userId, input.systemIds);
  }),

  setup: os.setup.handler(async ({ context }) => {
    await createInboxForUser(context.userId);
    return { ok: true as const };
  }),
});
