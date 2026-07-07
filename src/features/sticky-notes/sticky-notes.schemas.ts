import { z } from "zod";

export const colorValues = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;

// 'over' = flotante sobre el texto; 'left'/'right' = presets de gutter.
// Todas las flotantes se posicionan por positionX/Y relativas a la columna.
const positionSideValues = ["left", "right", "over"] as const;

// positionX es una fracción relativa a la columna de texto: 0 = borde izquierdo,
// 1 = borde derecho, negativa = gutter izquierdo, >1 = gutter derecho. El rango
// es amplio porque el clamp real a la pantalla ocurre al renderizar.
const positionXField = z.number().min(-5).max(5).nullable().optional();

export const createStickyNoteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500).optional(),
  color: z.enum(colorValues).optional(),
  textAnchor: z.string().nullable().optional(),
  positionSide: z.enum(positionSideValues).nullable().optional(),
  positionY: z.number().min(0).max(1).nullable().optional(),
  positionX: positionXField,
  anchorId: z.string().nullable().optional(),
  pageId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
});

export const updateStickyNoteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  content: z.string().max(500).nullable().optional(),
  color: z.enum(colorValues).optional(),
  positionSide: z.enum(positionSideValues).nullable().optional(),
  positionY: z.number().min(0).max(1).nullable().optional(),
  positionX: positionXField,
  anchorId: z.string().nullable().optional(),
  stackId: z.string().uuid().nullable().optional(),
  textAnchor: z.string().nullable().optional(),
});

export const stackStickyNotesSchema = z.object({
  draggedId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export type CreateStickyNoteInput = z.infer<typeof createStickyNoteSchema>;
export type UpdateStickyNoteInput = z.infer<typeof updateStickyNoteSchema>;
export type StackStickyNotesInput = z.infer<typeof stackStickyNotesSchema>;
