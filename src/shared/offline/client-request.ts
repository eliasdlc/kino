import { z } from "zod";

/**
 * Id de petición del cliente — la pieza que hace idempotente la captura offline
 * (KIN-57).
 *
 * Lo genera el navegador en el momento de pulsar "crear", **antes** de saber si
 * hay red, y viaja dentro de las *variables* de la mutación. Eso importa: las
 * variables son lo único que TanStack Query persiste de una mutación pausada, así
 * que un id generado dentro del `mutationFn` se perdería y la reproducción tras
 * reiniciar el navegador crearía una fila nueva.
 *
 * En el servidor cada tabla que lo acepta tiene un índice único parcial sobre
 * `(user_id, client_request_id)`, y el INSERT hace `onConflictDoNothing` +
 * relectura. Con eso, reproducir dos veces la misma creación —o que el INSERT
 * llegue y la respuesta se pierda por el camino— devuelve la fila original en vez
 * de duplicarla.
 *
 * Es opcional a propósito: todo lo que crea online sin pasar por la cola (el MCP,
 * los bulk, github-sync) sigue funcionando sin enviarlo.
 */
export const clientRequestIdField = z.string().uuid().optional();
