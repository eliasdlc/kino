import { describe, expect, it } from "vitest";
import { validateTaskKind } from "./tasks.metadata";

describe("validateTaskKind", () => {
  it("acepta un kind declarado por el arquetipo", () => {
    expect(validateTaskKind("academic", { kind: "exam" })).toBeNull();
    expect(validateTaskKind("entrepreneurial", { kind: "experiment" })).toBeNull();
    expect(validateTaskKind("personal", { kind: "habit" })).toBeNull();
  });

  it("rechaza un kind no declarado", () => {
    expect(validateTaskKind("academic", { kind: "sacrifice" })).not.toBeNull();
  });

  it("rechaza cualquier kind en un arquetipo sin taskKinds (project/inbox)", () => {
    expect(validateTaskKind("project", { kind: "board" })).not.toBeNull();
    expect(validateTaskKind("inbox", { kind: "anything" })).not.toBeNull();
  });

  it("no exige kind: metadata sin kind es válida", () => {
    expect(validateTaskKind("academic", { course: "Álgebra" })).toBeNull();
    expect(validateTaskKind("academic", {})).toBeNull();
    expect(validateTaskKind("academic", null)).toBeNull();
  });

  it("rechaza un kind que no es string", () => {
    expect(validateTaskKind("academic", { kind: 42 })).not.toBeNull();
  });
});
