import { oc, type } from "@orpc/contract";
import type { KinoScope } from "@/shared/lib/scopes";
import { toTransport, type Transport } from "./transport";

/**
 * Lo que una operación declara sobre sí misma más allá de su entrada y su
 * salida. Son las dos cosas que `route()` resolvía por configuración y que
 * ahora viajan con el contrato, para que la regla de permisos de un endpoint se
 * lea en el mismo sitio que su forma.
 */
export interface ApiMeta {
  /**
   * Sobreescribe el scope que se deriva del método. Para los POST que sólo leen
   * (`/insights/estimate` y compañía), donde exigir `kino:write` sería mentir
   * sobre lo que hace la operación.
   */
  scope?: KinoScope;
  /**
   * Exige la sesión del navegador: una clave API o un token OAuth recibe 403
   * aunque pertenezcan al mismo usuario. Es para lo que cambia credenciales,
   * cierra sesiones o borra la cuenta.
   */
  sessionOnly?: boolean;
}

/** Punto de partida de toda operación del contrato. */
export const endpoint = oc.$meta<ApiMeta>({});

/**
 * La salida de una operación que devuelve datos del servidor.
 *
 * Se declara con el tipo que produce el servicio y el cliente recibe su forma de
 * transporte, derivada. Como los dos tipos no son el mismo, oRPC exige la
 * conversión: no se puede declarar que sale texto ISO y devolver un `Date`.
 *
 * Para lo que no es una fila —un resumen, un conteo— va un Zod escrito a mano,
 * porque no hay de dónde derivarlo.
 */
export function output<T>() {
  return type<T, Transport<T>>(toTransport);
}

/** Una operación sin cuerpo. Dice `void` donde si no diría `unknown`. */
export function noContent() {
  return type<void>();
}
