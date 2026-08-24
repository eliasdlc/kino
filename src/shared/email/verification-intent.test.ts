import { describe, expect, it } from "vitest";
import { emailChangeTarget } from "./verification-intent";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.firma`;
}

describe("emailChangeTarget", () => {
  it("devuelve la dirección nueva cuando el token es de cambio de correo", () => {
    const token = fakeJwt({ email: "vieja@kino.dev", updateTo: "nueva@kino.dev" });
    expect(emailChangeTarget(token)).toBe("nueva@kino.dev");
  });

  it("devuelve null para el token del alta, que no lleva destino", () => {
    expect(emailChangeTarget(fakeJwt({ email: "nueva@kino.dev" }))).toBeNull();
  });

  it("no revienta con un token que no es JWT", () => {
    expect(emailChangeTarget("cualquier-cosa")).toBeNull();
    expect(emailChangeTarget("a.b.c")).toBeNull();
  });
});
