/**
 * La onda de un audio compartido, derivada del audio de verdad.
 *
 * Un documento pedía la onda con su duración y otro la prohibía con la regla de
 * que un affordance que no se puede usar está muerto. Los dos tienen razón a
 * medias, y la salida es que la onda deje de ser un dibujo: se calcula del
 * propio audio y marca por dónde va la reproducción. Si el navegador no puede
 * decodificar, no se dibuja nada y queda el control con su duración, que es lo
 * único que entonces es cierto.
 */

/** Cuántas barras tiene la onda. Bastantes para leerse, pocas para caber. */
export const BARRAS = 40;

/**
 * Reduce las muestras a una barra por tramo, con el pico de cada tramo. El pico
 * y no el promedio: el promedio aplana la voz hasta que todas las notas se ven
 * iguales.
 */
export function picosDe(muestras: Float32Array, barras = BARRAS): number[] {
  if (muestras.length === 0 || barras <= 0) return [];
  const porBarra = Math.max(1, Math.floor(muestras.length / barras));
  const picos: number[] = [];

  for (let barra = 0; barra < barras; barra += 1) {
    const desde = barra * porBarra;
    if (desde >= muestras.length) break;
    let pico = 0;
    for (let i = desde; i < Math.min(desde + porBarra, muestras.length); i += 1) {
      const valor = Math.abs(muestras[i] ?? 0);
      if (valor > pico) pico = valor;
    }
    picos.push(pico);
  }

  // Normalizar contra el pico más alto: una grabación baja se vería plana
  // contra una escala absoluta, y lo que interesa es su propia forma.
  const maximo = Math.max(...picos, 0);
  return maximo === 0 ? picos.map(() => 0) : picos.map((pico) => pico / maximo);
}

/** Segundos a `m:ss`, que es como se lee una nota de voz. */
export function duracionLegible(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const enteros = Math.floor(segundos);
  return `${Math.floor(enteros / 60)}:${String(enteros % 60).padStart(2, "0")}`;
}
