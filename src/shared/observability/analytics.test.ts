import { describe, it, expect } from "vitest";
import type { CaptureResult } from "posthog-js";
import {
  ANALYTICS_EVENTS,
  isAnalyticsEvent,
  scrubCapture,
  scrubPersonProperties,
  scrubProperties,
} from "./analytics";

function capture(event: string, properties: Record<string, unknown>): CaptureResult {
  return { uuid: "test", event, properties } as CaptureResult;
}

describe("scrubProperties", () => {
  it("deja pasar las propiedades declaradas para ese evento", () => {
    expect(
      scrubProperties("archetype_chosen", {
        segment: "escritores",
        identity: "escritor",
      }),
    ).toEqual({ segment: "escritores", identity: "escritor" });
  });

  it("descarta una propiedad que ese evento no declara", () => {
    // El caso que justifica la lista: `title` es el texto de una tarea.
    expect(scrubProperties("first_task_created", { title: "Terminar el capítulo 3" })).toEqual({});
  });

  it("deja pasar lo que PostHog necesita para ingerir", () => {
    // `token` y `distinct_id` no llevan `$`, así que una lista blanca ingenua se
    // las come y el servidor descarta el evento entero.
    expect(
      scrubProperties("signup_started", {
        token: "phc_abc",
        distinct_id: "user_1",
        segment: "escritores",
      }),
    ).toEqual({ token: "phc_abc", distinct_id: "user_1", segment: "escritores" });
  });

  it("descarta una propiedad declarada en otro evento", () => {
    expect(scrubProperties("signup_started", { segment: "builders", identity: "builder" })).toEqual({
      segment: "builders",
    });
  });

  it("no manda valores vacíos ni estructurados", () => {
    expect(
      scrubProperties("signup_completed", {
        segment: null,
        method: { provider: "google" },
      }),
    ).toEqual({});
  });

  it("quita la query del referente y deja el resto de la fontanería intacta", () => {
    expect(
      scrubProperties("segment_landing_viewed", {
        $referrer: "https://kino.app/systems/abc?q=novela",
        $lib: "web",
        segment: "escritores",
      }),
    ).toEqual({
      $referrer: "https://kino.app/systems/abc",
      $lib: "web",
      segment: "escritores",
    });
  });
});

describe("scrubPersonProperties", () => {
  it("quita la URL inicial y deja la atribución", () => {
    // Se guarda para siempre en el perfil: si la primera visita identificada
    // fuera `/systems/<id>?q=<búsqueda>`, ahí quedaría.
    expect(
      scrubPersonProperties({
        $initial_current_url: "https://kino.app/systems/abc?q=novela",
        $initial_pathname: "/systems/abc",
        $initial_referrer: "https://google.com/search?q=productividad",
        $initial_referring_domain: "google.com",
        segment: "escritores",
      }),
    ).toEqual({
      $initial_referrer: "https://google.com/search",
      $initial_referring_domain: "google.com",
      segment: "escritores",
    });
  });
});

describe("scrubCapture", () => {
  it("descarta un evento propio que nadie declaró", () => {
    expect(scrubCapture(capture("task_completed", {}))).toBeNull();
  });

  it("deja pasar los eventos internos de PostHog", () => {
    // `$identify` es el que enlaza al visitante anónimo con la cuenta recién
    // creada: sin él el funnel se corta en el registro.
    expect(scrubCapture(capture("$identify", {}))?.event).toBe("$identify");
  });

  it("recorta también las propiedades de la persona", () => {
    const result = scrubCapture({
      uuid: "test",
      event: "$identify",
      properties: { $set_once: { $initial_pathname: "/systems/abc", segment: "escritores" } },
      $set_once: { $initial_current_url: "https://kino.app/tasks?q=x", segment: "escritores" },
    } as unknown as CaptureResult);
    expect(result?.properties.$set_once).toEqual({ segment: "escritores" });
    expect(result?.$set_once).toEqual({ segment: "escritores" });
  });

  it("recorta las propiedades de un evento declarado", () => {
    const result = scrubCapture(
      capture("onboarding_completed", { identity: "escritor", firstSystemName: "Mi novela" }),
    );
    expect(result?.properties).toEqual({ identity: "escritor" });
  });
});

describe("ANALYTICS_EVENTS", () => {
  /**
   * La lista es el contrato del embudo, así que se fija aquí: quitar un paso o
   * añadir uno pasa por este test. El orden es el del recorrido real, desde la
   * landing hasta el primer item propio.
   */
  it("declara los siete pasos del embudo y ninguno más", () => {
    expect(Object.keys(ANALYTICS_EVENTS)).toEqual([
      "segment_landing_viewed",
      "signup_started",
      "signup_completed",
      "onboarding_started",
      "archetype_chosen",
      "onboarding_completed",
      "first_task_created",
    ]);
  });

  it("ya no admite el avance por pasos, que el alta nueva no tiene", () => {
    expect(isAnalyticsEvent("onboarding_step_viewed")).toBe(false);
    expect(scrubCapture(capture("onboarding_step_viewed", { step_index: 1 }))).toBeNull();
  });

  it("permite comparar el alta por segmento y por arquetipo", () => {
    // Sin `segment` en la entrada y `identity` en la elección, el embudo no
    // contesta de dónde vino quien se cae ni con qué arquetipo.
    expect(ANALYTICS_EVENTS.onboarding_started).toContain("segment");
    expect(ANALYTICS_EVENTS.archetype_chosen).toContain("segment");
    expect(ANALYTICS_EVENTS.archetype_chosen).toContain("identity");
  });
});
