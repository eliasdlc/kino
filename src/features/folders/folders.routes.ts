import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import { updateFolderSchema } from "./folders.schemas";
import { updateFolder, deleteFolder, getFolderById } from "./folders.service";
import { parseFolderMetadata } from "./folders.metadata";
import { getSystemById } from "@/features/systems/systems.service";
import type { SystemType } from "@/shared/lib/system-types";

type IdParam = { id: string };

// PATCH/DELETE /api/folders/[id]
export const PATCH = route<IdParam>()(
  { body: updateFolderSchema },
  async ({ userId, params, body }) => {
    const data = { ...body };

    // Solo si el update toca metadata resolvemos el arquetipo del folder para
    // validarla; un rename simple no paga esas queries.
    if (data.metadata !== undefined) {
      const folder = await getFolderById(params.id, userId);
      if (!folder) throw new NotFoundError("Folder not found");
      const system = folder.systemId ? await getSystemById(folder.systemId, userId) : null;
      const meta = parseFolderMetadata((system?.templateType ?? "custom") as SystemType, data.metadata);
      if (!meta.success) {
        // Se devuelve la respuesta a mano en vez de lanzar: este 400 lleva
        // `details` con los errores del schema, y ValidationError sólo carga
        // un mensaje.
        return NextResponse.json(
          { code: "VALIDATION_ERROR", message: "Invalid folder metadata", details: meta.error.flatten() },
          { status: 400 },
        );
      }
      data.metadata = meta.data;
    }

    const updated = await updateFolder(params.id, userId, data);
    if (!updated) throw new NotFoundError("Folder not found");
    return NextResponse.json(updated);
  },
);

export const DELETE = route<IdParam>()({}, async ({ userId, params }) => {
  const ok = await deleteFolder(params.id, userId);
  if (!ok) throw new NotFoundError("Folder not found");
  return new NextResponse(null, { status: 204 });
});
