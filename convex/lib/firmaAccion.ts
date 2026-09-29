// La firma de los botones de una notificación («Hecha», «En 1 h»).
//
// El service worker no tiene sesión de Clerk: cuando la persona pulsa un botón
// de la notificación no hay JWT que mandar. Lo que viaja es un enlace firmado
// por el servidor al construir el push: dice de qué tarea es y hasta cuándo
// vale, y sólo quien tiene el secreto pudo escribirlo. No abre nada más que
// esas dos acciones sobre esa tarea, y las dos son reversibles.
//
// El secreto es la clave privada VAPID con un prefijo propio: ya existe donde
// existe el push, no sale del deployment y no hace falta otra variable para
// algo que sin push no tiene sentido. Rotarla invalida los enlaces vivos, que
// es lo esperable.
//
// Web Crypto y no `node:crypto`, para que firme la acción de Node y verifique
// la ruta HTTP, que corre en el runtime por defecto.

/** Lo que vale un enlace: una semana, lo que una notificación puede seguir en pantalla. */
export const VIGENCIA_MS = 7 * 86_400_000;

const enc = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function clave(secreto: string) {
  return crypto.subtle.importKey('raw', enc.encode(`kino-push-accion:${secreto}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function firma(cuerpo: string, secreto: string): Promise<string> {
  return base64url(await crypto.subtle.sign('HMAC', await clave(secreto), enc.encode(cuerpo)));
}

export async function firmarAccion(taskId: string, secreto: string, ahora: number): Promise<string> {
  const cuerpo = `${taskId}.${ahora + VIGENCIA_MS}`;
  return `${cuerpo}.${await firma(cuerpo, secreto)}`;
}

/** Compara sin decir por dónde dejan de parecerse, como `sameSecret` de `http.ts`. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** El id de la tarea si el enlace es auténtico y sigue vigente; `null` si no. */
export async function verificarAccion(token: string, secreto: string, ahora: number): Promise<string | null> {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [taskId, exp, sig] = partes as [string, string, string];
  const vence = Number(exp);
  if (!taskId || !Number.isFinite(vence) || vence < ahora) return null;
  return iguales(sig, await firma(`${taskId}.${exp}`, secreto)) ? taskId : null;
}
