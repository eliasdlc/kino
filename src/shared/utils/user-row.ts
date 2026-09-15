import * as Sentry from "@sentry/nextjs";
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
 * Llama a `users.ensure` con el token de Convex de la sesión. Vuelve sin más
 * cuando la fila queda garantizada, y lanza cuando no.
 *
 * Que la falta de token lance en vez de devolver un `false` es la decisión que
 * importa aquí: una sesión viva sin token de la plantilla `convex` no es un
 * caso normal, es la plantilla renombrada o borrada en el panel de Clerk, y
 * eso no se arregla en el siguiente request. Devolver `false` lo dejaría
 * pasando de largo para siempre.
 */
export async function ensureRowInConvex(getToken: GetToken): Promise<void> {
  const token = await getToken({ template: "convex" });
  if (!token) throw new Error("Clerk no devolvió token para la plantilla `convex`");
  await fetchMutation(api.users.ensure, {}, { token });
}

/**
 * Asegura la fila como mucho una vez por navegador y deja la marca en la
 * respuesta. Con la marca puesta no llama a Convex, que es lo que hace que
 * navegar entre dos páginas no dispare ninguna escritura.
 *
 * Un fallo al asegurar no corta el request: se deja sin marca para que el
 * siguiente lo reintente, y la pantalla falla como falla hoy cuando no hay
 * fila. Cortar aquí convertiría un Convex caído en un login roto.
 *
 * **Pero no se traga en silencio.** Un Convex caído se arregla solo en el
 * siguiente request; una plantilla JWT que ya no se llama `convex`, o un error
 * de programación aquí dentro, no se arreglan nunca y dejan a toda cuenta
 * nueva sin fila sin que nadie se entere hasta que alguien se queja. Por eso va
 * a Sentry: es el único aviso que tiene este camino, que corre antes de
 * cualquier pantalla y no puede pintar un error.
 */
export async function ensureUserRow(
  request: NextRequest,
  response: NextResponse,
  clerkId: string,
  ensure: () => Promise<void>,
): Promise<void> {
  if (request.cookies.get(USER_ROW_COOKIE)?.value === clerkId) return;

  try {
    await ensure();
  } catch (error) {
    Sentry.captureException(error, { tags: { layer: "proxy-fila-usuario" } });
    console.error("[proxy] no se pudo asegurar la fila de users:", error);
    return;
  }

  response.cookies.set(USER_ROW_COOKIE, clerkId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });
}
