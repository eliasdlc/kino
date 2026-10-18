"use client";

import { useState } from "react";
import { Quote } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { MargenDeUnaLinea, UNA_LINEA } from "@/shared/components/una-linea";
import { useChapterSummary } from "./writing.hooks";

/**
 * Resumen del capítulo (KIN-143). No lo escribe Kino: **son frases del propio
 * capítulo**, elegidas por peso. Un resumen generado suena mejor pero puede
 * inventarse un detalle; este, como mucho, elige mal: y se nota al instante,
 * porque son las palabras del autor, literales.
 *
 * Se pide bajo demanda: la mayoría de las veces que se abre un capítulo es para
 * escribir, no para resumirlo.
 */
export function ChapterSummaryPanel({ pageId }: { pageId: string }) {
  const [asked, setAsked] = useState(false);
  const { data, isLoading } = useChapterSummary(asked ? pageId : null);

  return (
    <div>
      <SectionHead as="h3" title="Resumen" className="mb-1" />

      {!asked ? (
        <MarginRow
          onClick={() => setAsked(true)}
          className={UNA_LINEA}
          margin={<MargenDeUnaLinea><Quote aria-hidden className="size-5" /></MargenDeUnaLinea>}
        >
          <span className="block text-base text-foreground">Resumir este capítulo</span>
        </MarginRow>
      ) : isLoading ? (
        <p role="status" className="py-3 text-sm text-muted-foreground">
          Eligiendo las frases que más pesan
        </p>
      ) : !data || data.sentences.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Todavía no hay bastante texto para elegir frases.
        </p>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {data.sentences.map((sentence) => (
              <li
                key={sentence.position}
                className="border-l-2 border-border pl-3 font-serif text-sm leading-relaxed text-body"
              >
                {sentence.text}
              </li>
            ))}
          </ul>

          {data.keyTerms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.keyTerms.map((term) => (
                <span
                  key={term}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {term}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs leading-snug text-muted-foreground">
            Frases del propio capítulo, elegidas por peso. Nada está escrito por otro.
          </p>
        </div>
      )}
    </div>
  );
}
