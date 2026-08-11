import { describe, expect, it } from "vitest";
import { updateSystemSchema } from "./systems.schemas";

/**
 * `metadata` viaja como jsonb libre hasta la DB: si el schema no la acota, la
 * composición se convierte en un saco donde cualquier cliente escribe lo que
 * quiera y la UI lo lee como vocabulario.
 */
describe("updateSystemSchema · composición", () => {
  it("acepta una composición completa", () => {
    const parsed = updateSystemSchema.safeParse({
      metadata: {
        tabs: ["backlog", "action"],
        defaultTab: "action",
        composition: {
          containers: { enabled: true, noun: "expediente", nounPlural: "expedientes" },
          pages: { noun: "minuta", nounPlural: "minutas", primary: true },
          taskKinds: [{ id: "audiencia", label: "Audiencia" }],
        },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza sustantivos vacíos y kinds sin etiqueta", () => {
    expect(
      updateSystemSchema.safeParse({
        metadata: { composition: { containers: { enabled: true, noun: "  ", nounPlural: "x" } } },
      }).success,
    ).toBe(false);
    expect(
      updateSystemSchema.safeParse({
        metadata: { composition: { taskKinds: [{ id: "x", label: "" }] } },
      }).success,
    ).toBe(false);
  });

  it("no deja convertir el selector de kinds en un menú infinito", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `k${i}`, label: `Kind ${i}` }));
    expect(
      updateSystemSchema.safeParse({ metadata: { composition: { taskKinds: many } } }).success,
    ).toBe(false);
  });

  it("permite vaciar la metadata con null", () => {
    expect(updateSystemSchema.safeParse({ metadata: null }).success).toBe(true);
  });
});
