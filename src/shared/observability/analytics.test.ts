import { describe, it, expect } from "vitest";
import type { CaptureResult } from "posthog-js";
import { scrubCapture, scrubProperties } from "./analytics";

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

describe("scrubCapture", () => {
  it("descarta un evento propio que nadie declaró", () => {
    expect(scrubCapture(capture("task_completed", {}))).toBeNull();
  });

  it("deja pasar los eventos internos de PostHog", () => {
    // `$identify` es el que enlaza al visitante anónimo con la cuenta recién
    // creada: sin él el funnel se corta en el registro.
    expect(scrubCapture(capture("$identify", {}))?.event).toBe("$identify");
  });

  it("recorta las propiedades de un evento declarado", () => {
    const result = scrubCapture(
      capture("onboarding_completed", { identity: "escritor", firstSystemName: "Mi novela" }),
    );
    expect(result?.properties).toEqual({ identity: "escritor" });
  });
});
