import { oc } from "@orpc/contract";
import type { KinoScope } from "@/shared/lib/scopes";

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
