/**
 * Deja una URL sin query. Los parámetros llevan tokens de verificación, el
 * `state` del emparejamiento del CLI y términos de búsqueda, y la ruta sola ya
 * dice dónde ocurrió.
 *
 * Lo usan los dos servicios externos que reciben URLs de la app —el reporte de
 * errores y la analítica de producto—, y por eso vive aparte: si el recorte se
 * arreglara en uno y no en el otro, la fuga seguiría abierta por el otro lado.
 */
export function stripQuery(url: string): string {
  const cut = url.indexOf("?");
  return cut === -1 ? url : url.slice(0, cut);
}
