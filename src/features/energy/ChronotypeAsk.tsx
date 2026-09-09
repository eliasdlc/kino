'use client';

/** Cómo se llama cada cronotipo cuando el producto lo dice en voz alta. */
const NOMBRES: Record<string, string> = {
  morning: 'de mañana',
  intermediate: 'mixto',
  evening: 'de noche',
};

export interface ChronotypeMeasurement {
  /** El cronotipo que dice la curva medida. */
  medido: string;
  /** El que la persona declaró, o el que el alta puso por defecto. */
  declarado: string;
  /** Sobre cuántos días de medición. */
  dias: number;
  /** La ventana pico de la curva medida, en horas locales. */
  pico: { start: number; end: number };
}

/**
 * La pregunta del cronotipo, catorce días después.
 *
 * El alta la sacó del camino de entrada con el argumento de que un perfil
 * declarado el día 1 es una suposición. Esta es la otra mitad de esa decisión:
 * el momento en que el producto vuelve a preguntar, con la curva medida
 * delante en vez de con una suposición.
 *
 * Es el cuerpo de una línea de la cola, así que aparece una vez: si se ignora,
 * se acusa y no vuelve con la misma medición.
 */
export function ChronotypeAsk({ medicion }: { medicion: ChronotypeMeasurement }) {
  const { medido, declarado, dias, pico } = medicion;

  return (
    <span className="min-w-0">
      <b className="font-semibold text-foreground">
        Tu pico está entre las {pico.start} y las {pico.end}
      </b>
      , medido sobre {dias} días.
      <span className="text-muted-foreground">
        {' '}
        Eso es {NOMBRES[medido] ?? medido}, y tienes puesto {NOMBRES[declarado] ?? declarado}.
      </span>
    </span>
  );
}
