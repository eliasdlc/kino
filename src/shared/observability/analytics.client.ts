"use client";

import type { PostHog } from "posthog-js";
import {
  ANALYTICS_KEY,
  analyticsOptions,
  scrubProperties,
  type AnalyticsEvent,
  type AnalyticsPerson,
  type AnalyticsProperties,
} from "./analytics";

/**
 * El transporte del funnel: lo único que sabe que detrás hay PostHog. Las
 * listas de eventos y propiedades viven en `analytics.ts`, que es puro y no
 * importa la librería, así que cambiar de herramienta es reescribir este
 * archivo y nada más.
 *
 * La librería se carga aparte del bundle y sólo si hay clave. Sin clave, cada
 * llamada de aquí no hace nada: la app arranca igual y las landings no se
 * llevan 60 kB por una medición que no está encendida.
 *
 * El arranque cuelga del primer evento, y eso no es pereza: `instrumentation-client`
 * se compila en su propio grafo, así que arrancar desde ahí inicializaba una copia
 * de este módulo distinta de la que usan las pantallas. Los eventos se quedaban en
 * la cola de la otra copia para siempre y no salía ninguno, sin un solo error en
 * consola. Quien mueva el arranque fuera de aquí vuelve a romperlo igual de callado.
 */

let client: PostHog | null = null;
let starting = false;

/**
 * Lo que se disparó antes de que la librería terminara de cargar. El primer
 * evento del funnel es el que ocurre más pronto (la visita a la landing) y
 * perderlo sesgaría justo el número que se quiere leer.
 */
const pending: ((posthog: PostHog) => void)[] = [];
const MAX_PENDING = 20;

/** Quién es la persona en esta pestaña. Sin persistencia: el modo sin cookies no guarda nada. */
let identifiedUserId: string | null = null;

function withClient(call: (posthog: PostHog) => void): void {
  if (!ANALYTICS_KEY) return;
  if (client) {
    call(client);
    return;
  }
  if (pending.length < MAX_PENDING) pending.push(call);
  void start();
}

async function start(): Promise<void> {
  if (client || starting) return;
  starting = true;

  const { default: posthog } = await import("posthog-js");
  posthog.init(ANALYTICS_KEY, analyticsOptions);
  client = posthog;

  for (const call of pending.splice(0)) call(posthog);
}

export function track<E extends AnalyticsEvent>(
  event: E,
  properties?: AnalyticsProperties<E>,
  /**
   * Cuándo ocurrió de verdad, si no es ahora mismo. Un funnel ordena por la
   * marca de tiempo, así que un paso que se anuncia una pantalla más tarde
   * llegaría después del que lo sigue y el escalón daría cero.
   */
  occurredAt?: Date,
): void {
  // El recorte se aplica aquí y otra vez en `before_send`. Este primero evita
  // mandar un `null` como si fuera un valor; el segundo es el que garantiza que
  // nada indeclarado salga, venga de donde venga.
  const scrubbed = scrubProperties(event, properties ?? {});
  withClient((posthog) =>
    posthog.capture(event, scrubbed, occurredAt ? { timestamp: occurredAt } : undefined),
  );
}

/**
 * Sólo después del registro: antes de eso no hay cuenta y no hay nada que
 * identificar. `segment` se guarda una vez y no se pisa, porque la landing por
 * la que alguien entró no cambia.
 */
export function identifyUser(userId: string, person?: AnalyticsPerson): void {
  if (identifiedUserId === userId) return;
  identifiedUserId = userId;

  const setOnce = person?.segment ? { segment: person.segment } : undefined;
  withClient((posthog) => posthog.identify(userId, undefined, setOnce));
}

/** Al cerrar sesión. Si otra persona usa el mismo navegador, sus eventos son suyos. */
export function resetAnalytics(): void {
  identifiedUserId = null;
  withClient((posthog) => posthog.reset());
}

/**
 * Eventos que sólo cuentan la primera vez. `first_task_created` mide que
 * alguien llegó a usar el producto, no cuántas tareas escribe: mandarlo en cada
 * creación gastaría la cuota para siempre a cambio de nada.
 *
 * La marca es un booleano en el navegador, con el id de la propia cuenta en la
 * clave, no un identificador de seguimiento. Quien estrene un segundo
 * dispositivo lo disparará otra vez; el funnel de PostHog se queda con la
 * primera ocurrencia de cada persona, así que el número no se mueve.
 */
export function trackOnce<E extends AnalyticsEvent>(
  event: E,
  properties?: AnalyticsProperties<E>,
): void {
  if (!ANALYTICS_KEY || !identifiedUserId) return;

  const key = `kino:analytics:${event}:${identifiedUserId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Almacenamiento bloqueado (navegación privada, ajustes del navegador). Se
    // manda igual: repetir un evento estropea menos que perder el paso final.
  }

  track(event, properties);
}

/**
 * Registro y login social salen de la app y vuelven por un redirect, así que la
 * cuenta recién creada no se puede anunciar en el mismo sitio donde se pidió.
 * El formulario deja esta nota antes de irse y el layout de destino la recoge,
 * ya con la sesión montada. Vale para el registro con correo por la misma
 * razón: quien la lee es la pantalla siguiente.
 */
const SIGNUP_KEY = "kino:analytics:signup";

export interface PendingSignup {
  method: string;
  segment: string | null;
  /** Cuándo se creó la cuenta. Un alta social pasa por otro dominio y vuelve segundos después. */
  at: number;
}

export function markPendingSignup(signup: Omit<PendingSignup, "at">): void {
  try {
    window.sessionStorage.setItem(SIGNUP_KEY, JSON.stringify({ ...signup, at: Date.now() }));
  } catch {
    // Sin almacenamiento, el registro se completa igual y sólo falta su evento.
  }
}

/** Borra la nota cuando el alta no llegó a ocurrir (el redirect social que vuelve solo). */
export function clearPendingSignup(): void {
  try {
    window.sessionStorage.removeItem(SIGNUP_KEY);
  } catch {
    // Sin almacenamiento no hay nota que borrar.
  }
}

/** Devuelve la nota y la borra: el evento de cuenta creada es uno por cuenta. */
export function takePendingSignup(): PendingSignup | null {
  try {
    const raw = window.sessionStorage.getItem(SIGNUP_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(SIGNUP_KEY);

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { method, segment, at } = parsed as Record<string, unknown>;
    if (typeof method !== "string") return null;
    return {
      method,
      segment: typeof segment === "string" ? segment : null,
      at: typeof at === "number" ? at : Date.now(),
    };
  } catch {
    return null;
  }
}
