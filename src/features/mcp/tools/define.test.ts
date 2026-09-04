import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { describeError } from "./define";

describe("describeError · lo que lee el agente cuando Convex falla", () => {
  it("un alcance corto dice qué tiene y qué hace falta", () => {
    const text = describeError(new ConvexError({ code: "FORBIDDEN_SCOPE", granted: "read", required: "write" }));
    expect(text).toContain('alcance "read"');
    expect(text).toContain('exige "write"');
  });

  it("los errores de dominio conservan su código y su mensaje", () => {
    expect(describeError(new ConvexError({ code: "NOT_FOUND", message: "Task not found" }))).toBe("NOT_FOUND: Task not found");
  });

  it("un argumento inválido pierde el prefijo del servidor", () => {
    const raw = new Error("[Request ID: abc123] Server Error\nArgumentValidationError: Value does not match validator.\nPath: .id");
    expect(describeError(raw)).toMatch(/^ArgumentValidationError/);
  });
});
