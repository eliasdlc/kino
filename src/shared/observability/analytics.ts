import type { CaptureResult, PostHogConfig } from "posthog-js";
import { stripQuery } from "./strip-query";

/**
 * El funnel de registro, y sobre todo lo que no se mide.
 *
 * La pregunta que esto contesta es una sola: de la gente que entra por una
 * landing de segmento, cuánta acaba creando su primera tarea, y en qué paso del
 * onboarding se cae el resto. Nada más. No es analítica de uso, no cuenta
 * sesiones y no sabe qué escribe nadie.
 *
 * El criterio es el mismo de `sentry-options`: no se enumera lo peligroso, se
 * manda sólo lo que sirve. Aquí eso son dos listas cerradas —los eventos y, por
 * cada evento, sus propiedades— y todo lo que no esté en ellas se cae antes de
 * salir del navegador. Un evento nuevo no se puede mandar sin declararlo, que es
 * justo lo que impide que un título de tarea acabe en un panel.
 *
 * Sobre la privacidad: se mide sin cookies (`cookieless_mode`), así que no hay
 * banner que aceptar y el identificador anónimo lo calcula PostHog en su
 * servidor y rota cada día. El precio es que un funnel que cruce días se
 * rompería solo, y por eso —y sólo después del registro, cuando ya hay cuenta—
 * se llama a `identify()` con el `userId` que la app ya tiene. Es el id propio
 * del producto: no sirve en ningún otro sitio y no sigue a nadie entre webs.
 * PostHog desaconseja identificar en este modo, y tiene razón para una web
 * anónima; aquí el tramo anónimo (landing → empezar registro) sigue anónimo, y
 * el identificado es de alguien que ya decidió tener una cuenta.
 */

/**
 * Sin clave, la analítica queda inerte en vez de rota. Es el estado normal en
 * local y mientras la clave no esté cargada en Vercel: la app arranca igual y
 * nadie tiene que acordarse de comentar nada.
 */
export const ANALYTICS_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

/** Región del proyecto. La europea necesita declararlo; la de EEUU es el default. */
export const ANALYTICS_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Los seis pasos del funnel, más el avance dentro del onboarding, que es donde
 * de verdad se pierde la gente. El valor de cada entrada son las únicas
 * propiedades que ese evento puede llevar.
 *
 * `segment` es el slug de la landing (`/para/<slug>`) y es la dimensión que
 * permite comparar: sin ella la medición no contesta la pregunta. Viaja como
 * propiedad hasta el registro y, a partir de ahí, como propiedad de la persona,
 * porque `first_task_created` ocurre cuando el slug ya no está en ninguna URL.
 */
export const ANALYTICS_EVENTS = {
  segment_landing_viewed: ["segment"],
  signup_started: ["segment"],
  signup_completed: ["segment", "method"],
  onboarding_started: ["segment"],
  onboarding_step_viewed: ["segment", "step", "step_index"],
  onboarding_completed: ["segment", "identity"],
  first_task_created: [],
} as const satisfies Record<string, readonly string[]>;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;

/** Valores que caben en una propiedad. Nada estructurado sale de aquí. */
export type AnalyticsValue = string | number | boolean;

export type AnalyticsProperties<E extends AnalyticsEvent> = Partial<
  Record<(typeof ANALYTICS_EVENTS)[E][number], AnalyticsValue | null>
>;

/** Lo único que se guarda de la persona, y sólo al crear la cuenta. */
export interface AnalyticsPerson {
  segment?: string | null;
}

export function isAnalyticsEvent(name: string): name is AnalyticsEvent {
  return Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS, name);
}

/**
 * PostHog añade a cada evento de dónde se disparó. En una landing eso es
 * inofensivo, pero dentro de la app la URL lleva ids de páginas y el término de
 * búsqueda de la lista, así que las que sobran no se mandan. El referente sí se
 * queda —dice de dónde llegó la visita, que es media pregunta del ticket— pero
 * sin query, igual que en el reporte de errores.
 */
const DENIED_PROPERTIES = [
  "$current_url",
  "$pathname",
  "$initial_current_url",
  "$initial_pathname",
];

const REFERRER_PROPERTIES = new Set(["$referrer", "$initial_referrer"]);

/**
 * El recorte por evento. Las propiedades con `$` son la fontanería de PostHog
 * (versión de la librería, tipo de dispositivo, id de sesión) y pasan tal cual
 * salvo las que llevan una URL; las nuestras tienen que estar declaradas para
 * ese evento concreto.
 */
export function scrubProperties(
  event: string,
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const allowed: readonly string[] = isAnalyticsEvent(event) ? ANALYTICS_EVENTS[event] : [];
  const scrubbed: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(properties)) {
    if (name.startsWith("$")) {
      if (REFERRER_PROPERTIES.has(name)) {
        scrubbed[name] = typeof value === "string" ? stripQuery(value) : value;
      } else {
        scrubbed[name] = value;
      }
      continue;
    }

    if (!allowed.includes(name)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      continue;
    }
    scrubbed[name] = value;
  }

  return scrubbed;
}

/**
 * La última puerta antes de la red. Un evento propio que nadie declaró no sale,
 * y de los declarados sale sólo lo que su entrada permite. Los eventos internos
 * de PostHog (`$identify` y compañía) siguen su camino: son los que enlazan al
 * visitante anónimo con la cuenta que acaba de crear.
 */
export function scrubCapture(capture: CaptureResult | null): CaptureResult | null {
  if (!capture) return null;
  if (!capture.event.startsWith("$") && !isAnalyticsEvent(capture.event)) return null;

  capture.properties = scrubProperties(capture.event, capture.properties);
  return capture;
}

/**
 * Todo lo que PostHog hace por su cuenta está apagado a propósito. La captura
 * automática guarda el texto del elemento pulsado —el título de una tarea, el
 * nombre de un sistema—, la grabación de sesión graba la pantalla de alguien
 * escribiendo su novela, y ninguna de las dos contesta la pregunta del ticket.
 */
export const analyticsOptions: Partial<PostHogConfig> = {
  api_host: ANALYTICS_HOST,
  defaults: "2026-08-30",
  // Ojo: además de esto, el modo sin cookies hay que activarlo en los ajustes
  // del proyecto en PostHog. Si no, los eventos llegan y se descartan.
  cookieless_mode: "always",
  persistence: "memory",
  // Sin perfil para quien sólo pasó por una landing. Sólo lo tiene quien creó
  // una cuenta, que es de quien hace falta reconstruir el funnel.
  person_profiles: "identified_only",
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_heatmaps: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  rageclick: false,
  disable_session_recording: true,
  disable_surveys: true,
  // Los errores ya los reporta Sentry con su propio recorte; las banderas y los
  // tours no se usan. Nada de esto necesita descargarse.
  disable_external_dependency_loading: true,
  advanced_disable_feature_flags: true,
  property_denylist: DENIED_PROPERTIES,
  before_send: scrubCapture,
};
