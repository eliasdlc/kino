import { describe, expect, it } from "vitest";
import { resolveTrustedOrigins } from "./trusted-origins";

const APP_URL = "https://kino.app";

describe("resolveTrustedOrigins", () => {
  it("en producción la lista es sólo el dominio público", () => {
    expect(
      resolveTrustedOrigins(APP_URL, {
        env: "production",
        branchUrl: "kino-git-main-eliasdlc.vercel.app",
        deploymentUrl: "kino-abc123-eliasdlc.vercel.app",
      }),
    ).toEqual([APP_URL]);
  });

  it("en local, sin variables de Vercel, la lista no cambia", () => {
    expect(resolveTrustedOrigins("http://localhost:3000", {})).toEqual(["http://localhost:3000"]);
  });

  it("en un preview confía en el dominio de rama y en el del despliegue", () => {
    expect(
      resolveTrustedOrigins(APP_URL, {
        env: "preview",
        branchUrl: "kino-git-mi-rama-eliasdlc.vercel.app",
        deploymentUrl: "kino-abc123-eliasdlc.vercel.app",
      }),
    ).toEqual([
      APP_URL,
      "https://kino-git-mi-rama-eliasdlc.vercel.app",
      "https://kino-abc123-eliasdlc.vercel.app",
    ]);
  });

  it("un dominio con esquema se respeta tal cual", () => {
    expect(
      resolveTrustedOrigins(APP_URL, { env: "preview", branchUrl: "https://kino-git-x.vercel.app" }),
    ).toEqual([APP_URL, "https://kino-git-x.vercel.app"]);
  });

  it("un dominio ilegible se descarta en vez de romper el arranque", () => {
    expect(resolveTrustedOrigins(APP_URL, { env: "preview", branchUrl: "://" })).toEqual([APP_URL]);
  });

  it("no repite el origen si el preview coincide con el dominio público", () => {
    expect(resolveTrustedOrigins(APP_URL, { env: "preview", branchUrl: "kino.app" })).toEqual([
      APP_URL,
    ]);
  });
});
