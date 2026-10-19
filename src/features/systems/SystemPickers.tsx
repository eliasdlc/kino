"use client";

import { useRef, type KeyboardEvent } from "react";
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

/**
 * Un grupo de radios con una sola parada de Tab, como pide el patrón
 * radiogroup de ARIA: entra por el elegido (o el primero si no hay ninguno),
 * las flechas mueven el foco y eligen a la vez, Inicio y Fin van a los
 * extremos. Sin esto, once colores y veintiún iconos eran 32 tabulaciones.
 */
function useRovingRadio(values: readonly string[], value: string, onChange: (next: string) => void) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = values.indexOf(value);
  const tabbable = current === -1 ? 0 : current;

  function select(index: number) {
    const next = (index + values.length) % values.length;
    onChange(values[next]!);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        select(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        select(index - 1);
        break;
      case "Home":
        select(0);
        break;
      case "End":
        select(values.length - 1);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  return (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    tabIndex: index === tabbable ? 0 : -1,
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onKeyDown(e, index),
  });
}

const ICON_KEYS = Object.keys(ICON_MAP);

const OBJETIVO =
  "press flex size-[2.85rem] items-center justify-center rounded-full transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring md:pointer-fine:size-9";

/**
 * Los once colores de sistema como radios de 48 px en touch. El elegido lleva
 * el anillo en tinta: elegir es un estado, no una acción.
 */
export function SystemColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const radio = useRovingRadio(COLOR_VALUES, value, onChange);
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1">
      {COLOR_VALUES.map((c, i) => {
        const elegido = value === c;
        return (
          <button
            key={c}
            {...radio(i)}
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
                "size-6 rounded-full ring-offset-2 ring-offset-background transition-transform duration-(--dur-toque) ease-(--ease-pluma)",
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
  const radio = useRovingRadio(ICON_KEYS, value, onChange);
  return (
    <div role="radiogroup" aria-label="Ícono" className="grid grid-cols-6 gap-1 sm:grid-cols-8 md:grid-cols-10">
      {ICON_KEYS.map((key, i) => {
        const Icon = ICON_MAP[key];
        const elegido = value === key;
        return (
          <button
            key={key}
            {...radio(i)}
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
