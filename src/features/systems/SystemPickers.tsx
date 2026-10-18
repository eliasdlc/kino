"use client";

import { COLOR_VALUES } from "@/shared/types/enums";
import { getSystemColorCss } from "@/shared/utils/system-colors";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "./system-icons";
import { systemTileStyle } from "./system-tint";

/** El nombre de cada color en español: lo que se lee en voz alta. */
export const COLOR_LABEL: Record<string, string> = {
  red: "Rojo",
  blue: "Azul",
  pink: "Rosa",
  purple: "Morado",
  green: "Verde",
  orange: "Naranja",
  yellow: "Amarillo",
  teal: "Turquesa",
  gray: "Gris",
  black: "Negro",
  white: "Blanco",
};

/** El nombre de cada icono en español. */
export const ICON_LABEL: Record<string, string> = {
  folder: "Carpeta",
  briefcase: "Maletín",
  book: "Libro",
  graduation: "Birrete",
  feather: "Pluma",
  code: "Código",
  heart: "Corazón",
  star: "Estrella",
  target: "Diana",
  zap: "Rayo",
  globe: "Mundo",
  music: "Música",
  camera: "Cámara",
  coffee: "Café",
  home: "Casa",
  layers: "Capas",
  flask: "Matraz",
  money: "Dinero",
  gym: "Pesa",
  rocket: "Cohete",
  palette: "Paleta",
};

const OBJETIVO =
  "press flex size-[2.85rem] items-center justify-center rounded-full transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring md:pointer-fine:size-9";

/**
 * Los once colores de sistema como radios de 48 px en touch. El elegido lleva
 * el anillo en tinta: elegir es un estado, no una acción.
 */
export function SystemColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1">
      {COLOR_VALUES.map((c) => {
        const elegido = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={elegido}
            aria-label={COLOR_LABEL[c] ?? c}
            onClick={() => onChange(c)}
            className={OBJETIVO}
          >
            <span
              aria-hidden
              className={cn(
                "size-6 rounded-full ring-offset-2 ring-offset-background transition-transform duration-(--dur-toque)",
                elegido ? "scale-110 ring-2 ring-foreground" : "ring-1 ring-ln2",
              )}
              style={{ backgroundColor: getSystemColorCss(c) }}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Los iconos de sistema como radios de 48 px en touch; el elegido, en el tile teñido del color. */
export function SystemIconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Ícono" className="grid grid-cols-6 gap-1 sm:grid-cols-8 md:grid-cols-10">
      {Object.keys(ICON_MAP).map((key) => {
        const Icon = ICON_MAP[key];
        const elegido = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={elegido}
            aria-label={ICON_LABEL[key] ?? key}
            onClick={() => onChange(key)}
            className={cn(OBJETIVO, "rounded-xl", !elegido && "text-muted-foreground hover:bg-muted hover:text-foreground")}
            style={elegido ? systemTileStyle(color) : undefined}
          >
            <Icon aria-hidden className="size-5" />
          </button>
        );
      })}
    </div>
  );
}
