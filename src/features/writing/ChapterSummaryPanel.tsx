"use client";

import { useState } from "react";
import { Loader2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Resumen
      </p>

      {!asked ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 justify-start gap-2 px-2 text-sm font-normal"
          onClick={() => setAsked(true)}
        >
          <Quote className="size-3.5 shrink-0" />
          Resumir este capítulo
        </Button>
      ) : isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.sentences.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no hay bastante texto para elegir frases.
        </p>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {data.sentences.map((sentence) => (
              <li
                key={sentence.position}
                className="border-l-2 border-border pl-2 text-xs leading-relaxed text-muted-foreground"
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
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {term}
                </span>
              ))}
            </div>
          )}

          <p className="text-[10px] leading-snug text-muted-foreground/70">
            Frases del propio capítulo, elegidas por peso. Kino no escribe por ti.
          </p>
        </div>
      )}
    </div>
  );
}
