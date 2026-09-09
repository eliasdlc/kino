/**
 * El interruptor de honestidad: cuándo Kino admite que su techo del día está
 * mintiendo, y cuándo puede volver a opinar.
 *
 * Es el momento de voz más valioso del producto, y el único donde Kino pierde
 * en público y lo dice con la cifra delante. Vive aquí, puro, para que los dos
 * umbrales y la ventana se puedan probar con reloj inyectado y sin base.
 */

/**
 * Días de predicciones verificadas que hacen falta antes de que el interruptor
 * pueda dispararse. Con menos, un mal día bastaría para apagar el techo.
 *
 * Catorce es la misma ventana que el resto del motor ya usa para decidir si
 * tiene señal suficiente (`learningInsight` exige `historyDays >= 14`).
 */
export const DIAS_DE_ERROR = 14;

/**
 * Error medio, en puntos de energía, por encima del cual el techo deja de
 * pintarse como techo.
 */
export const APAGAR_POR_ENCIMA_DE = 25;

/**
 * Error medio por debajo del cual el techo puede volver.
 *
 * La distancia con el umbral de apagado es la histéresis, y es lo único que
 * evita que el techo parpadee: con un solo umbral, un error rondando los 25
 * apagaría y encendería en días alternos, y un instrumento que cambia de
 * opinión cada mañana es peor que uno que se equivoca.
 */
export const VOLVER_POR_DEBAJO_DE = 15;

/** Una predicción con su comprobación: el nivel predicho y el registrado. */
export interface PrediccionVerificada {
  /** Día calendario (yyyy-MM-dd) en la zona del usuario. */
  date: string;
  slot: string;
  predicted: number;
  reported: number;
}

/** Cuánto se equivocó una predicción, en puntos y sin signo. */
export function errorDe(prediccion: PrediccionVerificada): number {
  return Math.abs(prediccion.predicted - prediccion.reported);
}

/**
 * Error medio de las predicciones dadas, redondeado al punto. `null` cuando no
 * hay ninguna: cero sería decir que acertó siempre.
 */
export function errorMedio(predicciones: readonly PrediccionVerificada[]): number | null {
  if (predicciones.length === 0) return null;
  const suma = predicciones.reduce((total, p) => total + errorDe(p), 0);
  return Math.round(suma / predicciones.length);
}

/** Cuántos días distintos hay entre las predicciones. La ventana se mide en días. */
export function diasMedidos(predicciones: readonly PrediccionVerificada[]): number {
  return new Set(predicciones.map((p) => p.date)).size;
}

export type DecisionDelTecho = 'apagar' | 'proponerVuelta' | 'nada';

/**
 * Qué toca hacer con el techo, dadas las predicciones verificadas y si ahora
 * mismo está apagado.
 *
 * Apagar es la única escritura automática del producto sobre un dato de la
 * persona, y se justifica porque **apagar es la dirección segura**: un techo que
 * miente sigue midiendo el día, y un techo apagado sólo deja de opinar.
 * Encenderlo otra vez no: eso se propone, y pasa por la cola.
 */
export function decisionDelTecho(
  predicciones: readonly PrediccionVerificada[],
  apagado: boolean,
): DecisionDelTecho {
  if (diasMedidos(predicciones) < DIAS_DE_ERROR) return 'nada';
  const error = errorMedio(predicciones);
  if (error === null) return 'nada';

  if (!apagado) return error > APAGAR_POR_ENCIMA_DE ? 'apagar' : 'nada';
  return error < VOLVER_POR_DEBAJO_DE ? 'proponerVuelta' : 'nada';
}

/**
 * El cronotipo que dice la curva **medida**, leído de su hora pico.
 *
 * Es lo que permite volver a preguntar el cronotipo con el dato delante en vez
 * de con una suposición: el alta ya no lo pregunta porque un perfil declarado
 * el día 1 es una suposición, y este es el "después, cuando haya datos que lo
 * justifiquen" que nadie escribía.
 */
export function cronotipoDePico(horaPico: number): 'morning' | 'intermediate' | 'evening' {
  if (horaPico < 12) return 'morning';
  if (horaPico >= 17) return 'evening';
  return 'intermediate';
}
