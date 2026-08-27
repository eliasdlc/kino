import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";

/**
 * Lo que Kino le cuenta a Sentry, y sobre todo lo que no.
 *
 * Un informe de error trae, por defecto, mucho más de lo que hace falta para
 * arreglar el error: el cuerpo de la petición, las cookies, las migas de pan de
 * cada `fetch`. En una app de tareas eso sería molesto; en una que guarda
 * cuadernos —una novela a medias, las notas de una terapia— es material
 * personal saliendo del servidor de su dueño. Aquí se recorta antes de enviar.
 *
 * La regla es la contraria a la habitual: no se quita lo que parece sensible,
 * se manda sólo lo que sirve para depurar. Un `beforeSend` que enumerara campos
 * peligrosos se quedaría corto el día que alguien añada uno nuevo.
 *
 * El segundo cuidado es el ruido. Un porcentaje grande de los errores de
 * navegador que reporta cualquier web no son de la web: son extensiones,
 * traductores automáticos y bots. Si las alertas incluyen eso, dejan de
 * significar algo y se ignoran, que es peor que no tenerlas.
 */

/**
 * Sin DSN, Sentry queda inerte en vez de roto. Es el estado normal en local y
 * mientras la clave no esté cargada en Vercel: la app arranca igual y nadie
 * tiene que acordarse de comentar nada.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

/**
 * El commit desplegado. Es lo que convierte "falla algo" en "falla desde el
 * despliegue de ayer", y sin él una traza de producción no se puede situar.
 */
export const SENTRY_RELEASE =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;

export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development";

/**
 * Errores que no son de la app. Casi todos vienen de extensiones inyectando
 * scripts en la página, y ninguno es accionable.
 */
const IGNORED_ERRORS: (string | RegExp)[] = [
  // Extensiones y sus puentes de mensajes.
  /extension context invalidated/i,
  /Extension context/i,
  /chrome-extension/i,
  /moz-extension/i,
  "Non-Error promise rejection captured",
  // El traductor de Chrome reescribe el DOM bajo React y provoca esto.
  /removeChild.*not a child of this node/i,
  /insertBefore.*not a child of this node/i,
  // Navegación abortada por el usuario: no es un fallo.
  /AbortError/i,
  "TypeError: Failed to fetch",
  "TypeError: NetworkError when attempting to fetch resource.",
  "TypeError: cancelled",
  // ResizeObserver ruidoso, benigno y sin traza útil.
  /ResizeObserver loop/i,
];

/** Nada que venga de un origen que no es el nuestro merece una alerta. */
const DENIED_URLS: RegExp[] = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
  /^chrome:\/\//i,
];

/**
 * Cabeceras que sí ayudan a reproducir. Cualquier otra se cae, así que ni
 * `cookie` ni `authorization` pueden colarse por olvido.
 */
const KEPT_HEADERS = new Set(["user-agent", "referer", "content-type"]);

function keepOnlySafeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => KEPT_HEADERS.has(name.toLowerCase())),
  );
}

/**
 * Deja la URL sin query. Los parámetros llevan tokens de verificación, el
 * `state` del emparejamiento del CLI y términos de búsqueda, y la ruta sola ya
 * dice dónde ocurrió.
 */
function stripQuery(url: string): string {
  const cut = url.indexOf("?");
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * El recorte, aplicado a todo lo que sale. Devolver `null` descartaría el
 * evento entero; aquí sólo se le quita lo que no hace falta.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    // `data` es el cuerpo de la petición: en `update_page` eso es el capítulo
    // completo. Es exactamente lo que no puede salir de aquí.
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    if (event.request.headers) {
      event.request.headers = keepOnlySafeHeaders(event.request.headers);
    }
    delete event.request.query_string;
  }

  // Del usuario basta el id para saber si el fallo le pasa a uno o a todos.
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }

  return event;
}

/**
 * Las migas de pan son el otro escape: una de tipo `fetch` guarda el cuerpo de
 * la petición, y una de `console` guarda lo que se imprimió, que en esta app
 * puede ser el texto de una página.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;

  if (breadcrumb.data && typeof breadcrumb.data.url === "string") {
    breadcrumb.data.url = stripQuery(breadcrumb.data.url);
  }
  if (breadcrumb.data) {
    delete breadcrumb.data.body;
    delete breadcrumb.data.input;
  }

  return breadcrumb;
}

/**
 * Base común a navegador, servidor y edge. Cada entorno le añade lo suyo, pero
 * el recorte y los filtros son los mismos en los tres: un dato personal no deja
 * de serlo por salir del servidor en vez del navegador.
 */
export const sentryBaseOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  release: SENTRY_RELEASE,
  environment: SENTRY_ENVIRONMENT,
  // La IP y la cabecera de sesión sólo viajan si se piden. No se piden.
  sendDefaultPii: false,
  ignoreErrors: IGNORED_ERRORS,
  denyUrls: DENIED_URLS,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
  // Sin muestreo de rendimiento: el ticket pide enterarse de los fallos, y las
  // trazas de performance son el grueso de la cuota del plan gratuito.
  tracesSampleRate: 0,
} as const;
