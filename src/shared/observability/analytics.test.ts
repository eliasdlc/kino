import { describe, it, expect } from "vitest";
import type { CaptureResult } from "posthog-js";
import { scrubCapture, scrubPersonProperties, scrubProperties } from "./analytics";

function capture(event: string, properties: Record<string, unknown>): CaptureResult {
  return { uuid: "test", event, properties } as CaptureResult;
}

describe("scrubProperties", () => {
  it("deja pasar las propiedades declaradas para ese evento", () => {
    expect(
      scrubProperties("onboarding_step_viewed", {
        segment: "escritores",
        step: "identity",
        step_index: 1,
      }),
    ).toEqual({ segment: "escritores", step: "identity", step_index: 1 });
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
    expect(scrubProperties("signup_started", { segment: "builders", step: "identity" })).toEqual({
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
