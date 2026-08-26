import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import {
  createStickyNoteSchema,
  stackStickyNotesSchema,
  updateStickyNoteSchema,
} from "./sticky-notes.schemas";
import type { StickyNoteItem } from "./sticky-notes.types";

/**
 * Una nota cuelga de una página o de una carpeta, nunca de las dos, y por eso
 * cada dueño tiene su par de operaciones en vez de un `pageId` opcional que
 * habría que comprobar a mano.
 */
export const stickyNotesContract = {
  byPage: endpoint
    .route({ method: "GET", path: "/pages/{pageId}/sticky-notes" })
    .input(z.object({ pageId: z.string().uuid() }))
    .output(output<StickyNoteItem[]>()),

  createOnPage: endpoint
    .route({ method: "POST", path: "/pages/{pageId}/sticky-notes", successStatus: 201 })
    .input(createStickyNoteSchema.omit({ folderId: true }).extend({ pageId: z.string().uuid() }))
    .output(output<StickyNoteItem>()),

  byFolder: endpoint
    .route({ method: "GET", path: "/folders/{folderId}/sticky-notes" })
    .input(z.object({ folderId: z.string().uuid() }))
    .output(output<StickyNoteItem[]>()),

  createOnFolder: endpoint
    .route({ method: "POST", path: "/folders/{folderId}/sticky-notes", successStatus: 201 })
    .input(createStickyNoteSchema.omit({ pageId: true }).extend({ folderId: z.string().uuid() }))
    .output(output<StickyNoteItem>()),

  update: endpoint
    .route({ method: "PATCH", path: "/sticky-notes/{id}" })
    .input(updateStickyNoteSchema.extend({ id: z.string().uuid() }))
    .output(output<StickyNoteItem>()),

  remove: endpoint
    .route({ method: "DELETE", path: "/sticky-notes/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),

  // Devuelve las dos notas: la que se arrastró y la que la recibe, porque el
  // apilado cambia el sortIndex de ambas.
  stack: endpoint
    .route({ method: "POST", path: "/sticky-notes/stack" })
    .input(stackStickyNotesSchema)
    .output(output<{ dragged: StickyNoteItem; target: StickyNoteItem }>()),
};
