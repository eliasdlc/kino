import { fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { NextRequest, NextResponse } from "next/server";

/**
 * El suelo que garantiza la fila de `users` de quien entra.
 *
 * Quien la crea en el caso normal es el webhook `user.created` de Clerk
 * (`convex/http.ts`). Pero Clerk entrega ese evento en paralelo al redirect
 * del navegador, así que hay una ventana en la que la persona llega antes que
 * su fila, y `kinoQuery` responde `NO_USER` cuando no la encuentra. Esto es lo
 * que cierra esa ventana.
 *
 * **Va en el proxy y no en un layout porque es el único sitio que corre antes
 * del árbol.** Next renderiza layout y página en paralelo: un layout que
 * asegurara la fila dejaría a la página compitiendo con él, y la página puede
 * perder y pintar un error. El proxy corre entero antes de que se renderice
 * nada.
 */

/**
 * La marca de que este navegador ya tiene su fila. Guarda el id de Clerk y no
 * un booleano para que entrar con otra cuenta en el mismo navegador no herede
 * la marca de la anterior.
 *
 * No es una credencial y no decide ningún permiso: lo único que puede hacer
 * una marca falsificada es ahorrarse la llamada, y entonces la pantalla falla
 * igual que fallaría sin fila. No hay nada que ganar falsificándola.
 */
export const USER_ROW_COOKIE = "kino_fila";

/** Un año. La fila no caduca, así que su marca tampoco. */
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

type GetToken = (options: { template: string }) => Promise<string | null>;

/**
 * Llama a `users.ensure` con el token de Convex de la sesión. Devuelve si la
 * fila quedó garantizada: sin token no hay nada que garantizar, y sin
 * garantía no se pone la marca.
 */
export async function ensureRowInConvex(getToken: GetToken): Promise<boolean> {
  const token = await getToken({ template: "convex" });
  if (!token) return false;
  await fetchMutation(api.users.ensure, {}, { token });
  return true;
}

/**
 * Asegura la fila como mucho una vez por navegador y deja la marca en la
 * respuesta. Con la marca puesta no llama a Convex, que es lo que hace que
 * navegar entre dos páginas no dispare ninguna escritura.
 *
 * Un fallo al asegurar no corta el request: se deja sin marca para que el
 * siguiente lo reintente, y la pantalla falla como falla hoy cuando no hay
 * fila. Cortar aquí convertiría un Convex caído en un login roto.
 */
export async function ensureUserRow(
  request: NextRequest,
  response: NextResponse,
  clerkId: string,
  ensure: () => Promise<boolean>,
): Promise<void> {
  if (request.cookies.get(USER_ROW_COOKIE)?.value === clerkId) return;

  const ensured = await ensure().catch(() => false);
  if (!ensured) return;

  response.cookies.set(USER_ROW_COOKIE, clerkId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });
}
