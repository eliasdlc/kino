import { implement } from "@orpc/server";
import {
  authenticate,
  schemaError,
  translateDomainErrors,
  type ApiContext,
} from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { getSystemById } from "@/features/systems/systems.service";
import type { SystemType } from "@/shared/lib/system-types";
import { foldersContract } from "./folders.contract";
import { parseFolderMetadata } from "./folders.metadata";
import {
  createFolder,
  deleteFolder,
  getFolderById,
  getFolderChildren,
  getFoldersBySystem,
  updateFolder,
} from "./folders.service";

const os = implement(foldersContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

/** El arquetipo del sistema dueño decide qué Zod valida la metadata. */
function validateMetadata(templateType: string | null, metadata: unknown) {
  const parsed = parseFolderMetadata((templateType ?? "custom") as SystemType, metadata);
  if (!parsed.success) {
    throw schemaError("Invalid folder metadata", parsed.error.flatten());
  }
  return parsed.data;
}

export const foldersRouter = os.router({
  bySystem: os.bySystem.handler(({ context, input }) =>
    getFoldersBySystem(input.systemId, context.userId),
  ),

  create: os.create.handler(async ({ context, input }) => {
    // Sin sistema propio no hay carpeta, y su arquetipo decide la metadata.
    const system = await getSystemById(input.systemId, context.userId);
    if (!system) throw new NotFoundError("System not found");

    return createFolder(context.userId, {
      ...input,
      metadata: validateMetadata(system.templateType, input.metadata),
    });
  }),

  children: os.children.handler(({ context, input }) =>
    getFolderChildren(input.id, context.userId),
  ),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;

    // Sólo si el update toca metadata se resuelve el arquetipo: un rename
    // simple no paga esas dos queries.
    if (data.metadata !== undefined) {
      const folder = await getFolderById(id, context.userId);
      if (!folder) throw new NotFoundError("Folder not found");
      const system = folder.systemId
        ? await getSystemById(folder.systemId, context.userId)
        : null;
      data.metadata = validateMetadata(system?.templateType ?? null, data.metadata);
    }

    const updated = await updateFolder(id, context.userId, data);
    if (!updated) throw new NotFoundError("Folder not found");
    return updated;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    const ok = await deleteFolder(input.id, context.userId);
    if (!ok) throw new NotFoundError("Folder not found");
  }),
});
