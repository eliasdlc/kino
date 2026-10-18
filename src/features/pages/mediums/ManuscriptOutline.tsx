"use client";

import { Asterisk, BookOpen, Hash, RectangleHorizontal } from "lucide-react";
import { PanelHeading } from "../PanelHeading";
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
 *
 * Cada entrada es una fila del índice: el glifo de su clase en el margen
 * pequeño de la sangría y 48 px de alto en un dedo.
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
    <div className="space-y-1">
      <PanelHeading>{heading}</PanelHeading>

      {items.length === 0 ? (
        // Solo llega aquí el manuscrito: la lista de un documento normal no se
        // monta hasta que hay dos títulos, y con dos no está vacía.
        <p className="py-2 text-sm text-muted-foreground">
          Sin escenas todavía. Un separador o un título abren la primera.
        </p>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <button
                key={`${item.kind}-${item.pos}`}
                type="button"
                onClick={() => onJump(item.pos)}
                style={{ paddingLeft: `${0.25 + item.depth * 0.75}rem` }}
                className="flex min-h-9 items-center gap-2 rounded-md py-1 pr-2 text-left text-sm text-body transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-secondary hover:text-foreground pointer-coarse:min-h-[2.85rem]"
              >
                <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
