"use client";

import { Asterisk, BookOpen, Hash, RectangleHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutlineItem, OutlineKind } from "./outline";

const KIND_ICON: Record<OutlineKind, typeof Hash> = {
  scene: Asterisk,
  page: BookOpen,
  panel: RectangleHorizontal,
  heading: Hash,
};

/**
 * Índice del documento abierto (PLAN-11 §7). Las entradas se derivan del contenido
 * en cada tecleo, así que la lista siempre coincide con lo escrito; hacer clic
 * salta al bloque sin mover el cursor ni tocar el texto.
 *
 * Lo pintan dos sitios: el panel del manuscrito, que lo enseña siempre con sus
 * escenas, y el de un documento normal en un teléfono, donde el carril de
 * títulos no cabe. De ahí que el encabezado lo ponga quien llama.
 */
export function ManuscriptOutline({
  items,
  heading,
  onJump,
}: {
  items: readonly OutlineItem[];
  /** El encabezado del bloque: "En este capítulo", "En este documento". */
  heading: string;
  onJump: (pos: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}
      </p>

      {items.length === 0 ? (
        // Solo llega aquí el manuscrito: la lista de un documento normal no se
        // monta hasta que hay dos títulos, y con dos no está vacía.
        <p className="text-xs text-muted-foreground/70">
          Sin escenas todavía. Un separador o un título abren la primera.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <button
                key={`${item.kind}-${item.pos}`}
                type="button"
                onClick={() => onJump(item.pos)}
                style={{ paddingLeft: `${0.25 + item.depth * 0.75}rem` }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs transition-colors",
                  "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="size-3 shrink-0 opacity-60" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
