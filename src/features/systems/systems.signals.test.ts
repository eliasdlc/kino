/**
 * Criterio: el aviso de dormido nunca dice «0 días desde la última tarea»
 * cuando el sistema no ha completado ninguna: lo dice en palabras. Con días
 * contados, usa la plantilla de su arquetipo; sin dormir, no hay aviso.
 */
import { describe, expect, it } from "vitest";
import { formatStaleAdvisor } from "./systems.signals";
import type { SystemSignals } from "./systems.signals";

const base: SystemSignals = {
  status: "stale",
  stale: true,
  daysSinceLastActivity: null,
  activeTaskCount: 2,
  nextDueDate: null,
};
const sistema = { templateType: "project", name: "Recién creado" } as const;

describe("formatStaleAdvisor", () => {
  it("dormido sin ninguna hecha lo dice en palabras, sin cero días", () => {
    const aviso = formatStaleAdvisor(sistema, base);
    expect(aviso).toBe("Todavía no hay ninguna tarea hecha en Recién creado.");
    expect(aviso).not.toMatch(/0 días/);
  });

  it("con días contados usa la plantilla del arquetipo", () => {
    expect(formatStaleAdvisor(sistema, { ...base, daysSinceLastActivity: 9 })).toBe("9 días desde última tarea en Recién creado.");
  });

  it("sin dormir no hay aviso", () => {
    expect(formatStaleAdvisor(sistema, { ...base, stale: false, status: "active" })).toBeNull();
  });
});
