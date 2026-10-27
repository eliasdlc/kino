'use client';

import { useWordGate } from '@/features/settings/word-gate';

/**
 * A partir de cuántos caracteres un cuerpo deja de ser una nota al pie de una
 * tarea y pasa a ser un texto. Por debajo, ofrecer una página sería ruido.
 */
export const CUERPO_LARGO = 280;

interface BodyGateProps {
  /** Lo que hay escrito en el cuerpo de la tarea ahora mismo. */
  body: string;
  /** Mueve el cuerpo a una página del sistema y la enlaza a la tarea. */
  onConvert: () => void;
}

/**
 * La puerta del cuaderno: la primera vez que escribes un cuerpo largo en una
 * tarea, la palabra "página" aparece atada a ese gesto en vez de explicada en
 * una pantalla de bienvenida.
 *
 * Aparece una vez y no vuelve. No es una interrupción de Hoy: vive donde
 * ocurrió el gesto, debajo del campo que acabas de llenar.
 */
export function BodyGate({ body, onConvert }: BodyGateProps) {
  const visible = useWordGate('pagina', body.length >= CUERPO_LARGO);
  if (!visible) return null;

  return (
    // Un renglón con hairline, no un aviso en caja: es una línea más de la
    // hoja, debajo de lo que acabas de escribir.
    <div className="flex items-center gap-3 border-t border-border py-1 text-sm">
      <p className="min-w-0 font-voice text-base text-body italic">Esto ya es una página.</p>
      <button
        type="button"
        onClick={onConvert}
        className="focus-ring ml-auto min-h-[2.85rem] shrink-0 rounded-full px-3 text-sm font-semibold text-primary transition-[background-color] duration-(--dur-toque) ease-(--ease-pluma) hover:bg-primary/10"
      >
        Convertirla
      </button>
    </div>
  );
}
