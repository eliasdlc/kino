'use client';

/**
 * El cuerpo de la línea del lunes: lo que hiciste la semana pasada, con una
 * frase tuya literal delante.
 *
 * La cita es la mitad del criterio de muerte del diario, así que se pinta como
 * lo que es, palabras tuyas, y no como un resumen más. Cuando el extractor no
 * encontró ninguna frase que citar se dice: una semana sin cita sigue teniendo
 * su resumen, y callarlo dejaría la línea diciendo menos de lo que sabe.
 */

/** El tope con el que el extractor recorta, para saber si lo que llegó viene cortado. */
const CITA_MAX = 280;

export function InterruptionBody({ summary, quote }: { summary: string; quote: string }) {
  const recortada = quote.length >= CITA_MAX;

  return (
    <span className="min-w-0">
      {quote ? (
        <q className="font-medium text-foreground">{quote}</q>
      ) : (
        <span className="text-muted-foreground">Sin ninguna frase que citar de esa semana.</span>
      )}
      {recortada && <span className="text-muted-foreground"> (recortada)</span>}
      <span className="text-muted-foreground"> · {summary}</span>
    </span>
  );
}
