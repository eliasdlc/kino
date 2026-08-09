import { describe, expect, it } from "vitest";
import { githubRepoRefSchema, linkRepoSchema } from "./github-sync.schemas";

describe("githubRepoRefSchema", () => {
  it("acepta un owner y un repo normales", () => {
    expect(
      githubRepoRefSchema.parse({ owner: "eliasdlc", repo: "kino" }),
    ).toEqual({ owner: "eliasdlc", repo: "kino" });
  });

  it("acepta los caracteres que GitHub permite en un repositorio", () => {
    expect(
      githubRepoRefSchema.parse({ owner: "org-name", repo: "my_repo.js" }).repo,
    ).toBe("my_repo.js");
  });

  // Lo que se valida aquí termina en una URL de api.github.com.
  it.each([
    ["barra en el owner", { owner: "a/b", repo: "kino" }],
    ["path traversal", { owner: "eliasdlc", repo: "../../user" }],
    ["query pegada", { owner: "eliasdlc", repo: "kino?x=1" }],
    ["owner vacío", { owner: "", repo: "kino" }],
    ["guion al inicio del owner", { owner: "-mal", repo: "kino" }],
  ])("rechaza %s", (_caso, valor) => {
    expect(githubRepoRefSchema.safeParse(valor).success).toBe(false);
  });
});

describe("linkRepoSchema", () => {
  it("acepta owner y repo por separado", () => {
    expect(linkRepoSchema.parse({ owner: "eliasdlc", repo: "kino" })).toEqual({
      owner: "eliasdlc",
      repo: "kino",
    });
  });

  // Es como la gente tiene el dato a mano: copiado de la barra del navegador.
  it("acepta 'owner/repo' pegado", () => {
    expect(linkRepoSchema.parse({ fullName: "eliasdlc/kino" })).toEqual({
      owner: "eliasdlc",
      repo: "kino",
    });
  });

  it("tolera espacios alrededor", () => {
    expect(linkRepoSchema.parse({ fullName: "  eliasdlc/kino  " })).toEqual({
      owner: "eliasdlc",
      repo: "kino",
    });
  });

  it.each([
    ["sin barra", { fullName: "kino" }],
    ["con URL entera", { fullName: "https://github.com/eliasdlc/kino" }],
    ["vacío", {}],
    ["sólo el owner", { owner: "eliasdlc" }],
  ])("rechaza %s", (_caso, valor) => {
    expect(linkRepoSchema.safeParse(valor).success).toBe(false);
  });
});
