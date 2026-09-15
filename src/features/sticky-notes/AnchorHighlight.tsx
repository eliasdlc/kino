"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSharedEditor } from "@/features/pages/EditorContext";
import { setAnchorPaint } from "./anchor-paint.extension";
import { anchorTint } from "./sticky-note-colors";
import type { StickyNoteItem } from "./sticky-notes.types";

interface AnchorHighlight {
  /** El ancla de la pareja encendida ahora mismo, si hay alguna. */
  lit: string | null;
  /** La enciende. `null` las apaga todas. */
  light: (anchorId: string | null) => void;
}

const APAGADO: AnchorHighlight = { lit: null, light: () => {} };

const AnchorHighlightContext = createContext<AnchorHighlight>(APAGADO);

/**
 * Las dos mitades de la pareja: la nota y la frase que anota.
 *
 * Mirar cualquiera de las dos enciende las dos, asi que el dato vive por encima
 * del editor y de las tarjetas en vez de dentro de una de ellas. Fuera de un
 * cuaderno el contexto no existe y la tarjeta se pinta apagada, que es lo
 * correcto: en la papelera o en una carpeta no hay frase que encender.
 */
export function useAnchorHighlight(): AnchorHighlight {
  return useContext(AnchorHighlightContext);
}

export function AnchorHighlightProvider({ children }: { children: React.ReactNode }) {
  const [lit, setLit] = useState<string | null>(null);
  // `children` llega del padre, asi que encender una pareja no vuelve a
  // renderizar el editor: solo se entera quien lee el contexto.
  const value = useMemo<AnchorHighlight>(() => ({ lit, light: setLit }), [lit]);
  return <AnchorHighlightContext.Provider value={value}>{children}</AnchorHighlightContext.Provider>;
}

/**
 * Le pasa al editor de que color va cada frase anotada, y cual es la pareja
 * encendida.
 *
 * Tambien es la mitad frase del gesto: pasar el raton por encima de una frase
 * enciende su nota, igual que pasarlo por la nota enciende su frase. Un ancla
 * de posicion no entra, porque no anota nada y no tiene pareja que encender.
 */
export function AnchorPaint({ notes }: { notes: StickyNoteItem[] }) {
  const editor = useSharedEditor();
  const { lit, light } = useAnchorHighlight();

  const tints = useMemo(() => {
    const porAncla: Record<string, string | null> = {};
    for (const note of notes) {
      if (note.anchorId) porAncla[note.anchorId] = anchorTint(note.color);
    }
    return porAncla;
  }, [notes]);

  useEffect(() => {
    if (editor) setAnchorPaint(editor, { tints, lit });
  }, [editor, tints, lit]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    // `mouseover` y no `mouseenter`: burbujea, asi que salir de la frase a
    // texto normal tambien llega aqui y apaga la pareja.
    const entrar = (e: MouseEvent) => {
      const marca = (e.target as HTMLElement | null)?.closest?.("span[data-anchor-id]");
      const anota = marca instanceof HTMLElement && !marca.hasAttribute("data-anchor-muted");
      light(anota ? marca.getAttribute("data-anchor-id") : null);
    };
    const salir = () => light(null);

    dom.addEventListener("mouseover", entrar);
    dom.addEventListener("mouseleave", salir);
    return () => {
      dom.removeEventListener("mouseover", entrar);
      dom.removeEventListener("mouseleave", salir);
    };
  }, [editor, light]);

  return null;
}
