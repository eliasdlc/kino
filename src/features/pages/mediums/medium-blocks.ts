import {
  Asterisk,
  Clapperboard,
  Film,
  MessageSquare,
  Parentheses,
  RectangleHorizontal,
  User,
  BookOpen,
} from "lucide-react";
import type { SlashItem } from "../SlashMenu";
import type { MediumBlockId, MediumManifest } from "@/shared/lib/mediums";

/**
 * Bloques que cada medium suma al slash menu (PLAN-11 §6: "el slash menu existente
 * se extiende por medium"). El menú base (títulos, listas, tabla, imagen) no
 * cambia; esto es lo propio de la forma de la obra.
 */
const MEDIUM_BLOCKS: Record<MediumBlockId, SlashItem> = {
  sceneBreak: {
    title: "Separador de escena",
    subtitle: "Corta la escena dentro del capítulo",
    icon: Asterisk,
    keywords: ["escena", "scene", "separador", "break", "corte"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setSceneBreak().run(),
  },
  mangaPage: {
    title: "Página",
    subtitle: "Página de guion con su primer panel",
    icon: BookOpen,
    keywords: ["pagina", "page", "manga", "comic"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertMangaPage().run(),
  },
  panel: {
    title: "Panel",
    subtitle: "Viñeta: descripción, diálogo y SFX",
    icon: RectangleHorizontal,
    keywords: ["panel", "vineta", "beat", "cuadro"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertPanel().run(),
  },
  sceneHeading: {
    title: "Encabezado de escena",
    subtitle: "INT. LUGAR - DÍA",
    icon: Clapperboard,
    keywords: ["escena", "scene", "int", "ext", "encabezado", "slugline"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("sceneHeading").run(),
  },
  action: {
    title: "Acción",
    subtitle: "Lo que se ve en pantalla",
    icon: Film,
    keywords: ["accion", "action", "descripcion"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("action").run(),
  },
  character: {
    title: "Personaje",
    subtitle: "Quien habla",
    icon: User,
    keywords: ["personaje", "character", "habla"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("character").run(),
  },
  parenthetical: {
    title: "Paréntesis",
    subtitle: "Acotación del diálogo",
    icon: Parentheses,
    keywords: ["parentesis", "parenthetical", "acotacion"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("parenthetical").run(),
  },
  dialogue: {
    title: "Diálogo",
    subtitle: "Lo que dice el personaje",
    icon: MessageSquare,
    keywords: ["dialogo", "dialogue", "habla", "linea"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("dialogue").run(),
  },
};

/** Items extra del slash menu para el medium de la obra abierta. */
export function mediumSlashItems(medium: MediumManifest | null): SlashItem[] {
  if (!medium) return [];
  return medium.blocks.map((id) => MEDIUM_BLOCKS[id]);
}
