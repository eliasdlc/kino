"use client";

import { createContext, useContext, useMemo, useRef, useState, type RefObject } from "react";
import type { AnchorState } from "./reviews.types";

/**
 * El estado de pantalla de una revisión, compartido entre el botón de la barra
 * del cuaderno, el panel y el editor. Los tres viven en ramas distintas del
 * árbol (el editor se carga aparte, bajo demanda), así que se hablan por aquí y
 * no por props.
 *
 * Es estado de interfaz y nada más: qué comentario está encendido, si el panel
 * está abierto y dónde está cada fragmento en el texto que el editor tiene
 * delante. Los comentarios en sí son de Convex.
 */

/** Lo que el editor le presta al panel. Lo rellena el puente cuando el editor monta. */
export interface ReviewEditorActions {
  /** Lleva la vista al fragmento del comentario. */
  jumpTo: (commentId: string) => void;
  /** Sustituye el fragmento por la propuesta, como una edición más de la persona. */
  apply: (commentId: string, text: string) => boolean;
  /** Lo que hay seleccionado ahora en el editor, con su contexto, o nada. */
  selection: () => { quote: string; prefix: string; suffix: string } | null;
}

export interface ReviewAnchors {
  /** Los comentarios abiertos en el orden en que aparecen en el texto. */
  order: readonly string[];
  states: ReadonlyMap<string, AnchorState>;
}

interface ReviewUi {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  anchors: ReviewAnchors;
  setAnchors: (anchors: ReviewAnchors) => void;
  editor: RefObject<ReviewEditorActions | null>;
}

const VACIO: ReviewAnchors = { order: [], states: new Map() };

const ReviewContext = createContext<ReviewUi | null>(null);

export function ReviewProvider({ children, initialOpen = false }: { children: React.ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<ReviewAnchors>(VACIO);
  const editor = useRef<ReviewEditorActions | null>(null);
  const value = useMemo(
    () => ({ open, setOpen, activeId, setActiveId, anchors, setAnchors, editor }),
    [open, activeId, anchors],
  );
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

/** Fuera de un cuaderno no hay revisión: quien lo llama sin provider no pinta nada. */
export function useReviewUi(): ReviewUi | null {
  return useContext(ReviewContext);
}
