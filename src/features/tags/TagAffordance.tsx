'use client';

import { useWordGate } from '@/features/settings/word-gate';

/** Una almohadilla seguida de al menos una letra. Un `#` suelto no es nada. */
const ALMOHADILLA = /#[\p{L}\p{N}][\p{L}\p{N}_-]*/u;

/** La primera almohadilla escrita, sin el signo. `null` si no hay ninguna. */
export function almohadillaEn(text: string): string | null {
  const match = ALMOHADILLA.exec(text);
  return match ? match[0].slice(1) : null;
}

interface TagAffordanceProps {
  /** El texto donde se busca la almohadilla. */
  text: string;
  /** Crea la etiqueta con ese nombre y se la pone a lo que se está escribiendo. */
  onCreate: (name: string) => void;
}

/**
 * La puerta de la etiqueta: escribir una almohadilla es lo que hace aparecer la
 * palabra, en el sitio donde se escribió y una sola vez.
 *
 * Kino no tenía dónde descubrir las etiquetas: existían en un selector con su
 * nombre puesto, que es exactamente explicar el vocabulario en vez de dejar que
 * aparezca cuando lo tocas.
 */
export function TagAffordance({ text, onCreate }: TagAffordanceProps) {
  const nombre = almohadillaEn(text);
  const visible = useWordGate('etiqueta', nombre !== null);
  if (!visible || !nombre) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
      <p className="min-w-0 truncate text-foreground/80">
        <b className="font-semibold text-foreground">#{nombre}</b> puede ser una etiqueta.
      </p>
      <button
        type="button"
        onClick={() => onCreate(nombre)}
        className="ml-auto min-h-12 shrink-0 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        Crearla
      </button>
    </div>
  );
}
