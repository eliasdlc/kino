import { describe, expect, it } from "vitest";
import { resolveManifest } from "@/shared/lib/system-manifest";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";
import { validateTaskKind } from "./tasks.metadata";

const academic = SYSTEM_TYPE_CONFIG.academic;

describe("validateTaskKind", () => {
  it("acepta un kind declarado por el arquetipo", () => {
    expect(validateTaskKind(academic, { kind: "exam" })).toBeNull();
    expect(validateTaskKind(SYSTEM_TYPE_CONFIG.entrepreneurial, { kind: "experiment" })).toBeNull();
    expect(validateTaskKind(SYSTEM_TYPE_CONFIG.personal, { kind: "habit" })).toBeNull();
  });

  it("rechaza un kind no declarado", () => {
    expect(validateTaskKind(academic, { kind: "sacrifice" })).not.toBeNull();
  });

  it("rechaza cualquier kind en un arquetipo sin taskKinds (project/inbox)", () => {
    expect(validateTaskKind(SYSTEM_TYPE_CONFIG.project, { kind: "board" })).not.toBeNull();
    expect(validateTaskKind(SYSTEM_TYPE_CONFIG.inbox, { kind: "anything" })).not.toBeNull();
  });

  it("acepta los kinds que compuso un sistema custom, y solo esos", () => {
    const manifest = resolveManifest("custom", {
      composition: { taskKinds: [{ id: "audiencia", label: "Audiencia" }] },
    });
    expect(validateTaskKind(manifest, { kind: "audiencia" })).toBeNull();
    expect(validateTaskKind(manifest, { kind: "exam" })).not.toBeNull();
    // Sin componer nada, custom sigue sin admitir kinds.
    expect(validateTaskKind(resolveManifest("custom", null), { kind: "audiencia" })).not.toBeNull();
  });

  it("no exige kind: metadata sin kind es válida", () => {
    expect(validateTaskKind(academic, { course: "Álgebra" })).toBeNull();
    expect(validateTaskKind(academic, {})).toBeNull();
    expect(validateTaskKind(academic, null)).toBeNull();
  });

  it("rechaza un kind que no es string", () => {
    expect(validateTaskKind(academic, { kind: 42 })).not.toBeNull();
  });
});
