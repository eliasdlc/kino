import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchIssues, fetchRepoFullName } from "./github-sync.client";
import { GithubApiError } from "./github-sync.types";

const REF = { owner: "eliasdlc", repo: "kino" };
const TOKEN = "gho_token";

function ok(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function fail(status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ message: "nope" }), { status, headers });
}

function rawIssue(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    number: 1,
    title: "Un issue",
    body: null,
    state: "open",
    html_url: "https://github.com/eliasdlc/kino/issues/1",
    milestone: null,
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

/** Una página llena, con el `updated_at` creciendo como la pide la petición. */
function paginaLlena(desde: number) {
  return Array.from({ length: 100 }, (_, i) =>
    rawIssue({
      id: desde + i,
      updated_at: new Date(Date.UTC(2026, 0, 1) + (desde + i) * 60_000).toISOString(),
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("autenticación de las peticiones", () => {
  it("manda el token como Bearer y fija la versión de la API", async () => {
    fetchMock.mockResolvedValue(ok({ full_name: "eliasdlc/kino" }));

    await fetchRepoFullName(REF, TOKEN);
    const [, init] = fetchMock.mock.calls[0];

    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    expect((init.headers as Record<string, string>)["X-GitHub-Api-Version"]).toBe(
      "2022-11-28",
    );
  });

  it("escapa owner y repo en la URL", async () => {
    fetchMock.mockResolvedValue(ok({ full_name: "a/b" }));

    await fetchRepoFullName({ owner: "a b", repo: "c/d" }, TOKEN);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/a%20b/c%2Fd",
    );
  });
});

describe("errores de GitHub", () => {
  // La distinción que decide qué botón enseña la UI: reconectar, o esperar.
  it("un 401 se marca como token revocado", async () => {
    fetchMock.mockResolvedValue(fail(401));

    await expect(fetchRepoFullName(REF, TOKEN)).rejects.toMatchObject({
      name: "GithubApiError",
      status: 401,
      unauthorized: true,
    });
  });

  it("un 403 con el cupo agotado es rate limit, no credencial inválida", async () => {
    fetchMock.mockResolvedValue(fail(403, { "x-ratelimit-remaining": "0" }));

    await expect(fetchRepoFullName(REF, TOKEN)).rejects.toMatchObject({
      unauthorized: false,
    });
    await expect(fetchRepoFullName(REF, TOKEN)).rejects.toThrow(/limitando/i);
  });

  it("un 404 explica que el repositorio no existe o no es accesible", async () => {
    fetchMock.mockResolvedValue(fail(404));

    await expect(fetchRepoFullName(REF, TOKEN)).rejects.toThrow(
      /no existe o la cuenta conectada no tiene acceso/i,
    );
  });

  it("un fallo de red se envuelve en el mismo tipo de error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    await expect(fetchRepoFullName(REF, TOKEN)).rejects.toBeInstanceOf(
      GithubApiError,
    );
  });
});

describe("fetchIssues", () => {
  it("descarta los pull requests, que la API devuelve mezclados", async () => {
    fetchMock.mockResolvedValue(
      ok([
        rawIssue({ id: 1 }),
        rawIssue({ id: 2, pull_request: { url: "..." } }),
        rawIssue({ id: 3 }),
      ]),
    );

    const { issues } = await fetchIssues(REF, TOKEN);

    expect(issues.map((i) => i.id)).toEqual([1, 3]);
  });

  it("pide también los cerrados: son los que mueven la tarjeta", async () => {
    fetchMock.mockResolvedValue(ok([]));

    await fetchIssues(REF, TOKEN);

    expect(fetchMock.mock.calls[0][0]).toContain("state=all");
  });

  it("para de paginar cuando la página viene incompleta", async () => {
    fetchMock.mockResolvedValue(ok([rawIssue()]));

    const { truncated } = await fetchIssues(REF, TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(truncated).toBe(false);
  });

  // El free tier corta a 10s: mejor traer de más a menos y avisar, que morir
  // a mitad sin decir nada.
  it("corta al tope de páginas y lo reporta", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        ok(Array.from({ length: 100 }, (_, i) => rawIssue({ id: i + 1 }))),
      ),
    );

    const { issues, truncated } = await fetchIssues(REF, TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(issues).toHaveLength(300);
    expect(truncated).toBe(true);
  });

  // Lo que hace que el cursor converja: lo que se cae por el tope es lo más
  // nuevo, que es justo lo que el siguiente refresco pide. Y es por **fecha de
  // cambio**, no por antigüedad del issue: el primer tramo trae lo que lleva
  // más tiempo sin tocarse, que puede ser un issue reciente. El copy del panel
  // lo dice así porque es esta línea la que lo decide.
  it("ordena por fecha de cambio, del que lleva más tiempo sin tocarse al más reciente", async () => {
    fetchMock.mockResolvedValue(ok([]));

    await fetchIssues(REF, TOKEN);

    expect(fetchMock.mock.calls[0][0]).toContain("sort=updated&direction=asc");
  });

  it("al cortar por el tope dice hasta dónde llegó, y el siguiente refresco arranca ahí", async () => {
    let pagina = 0;
    fetchMock.mockImplementation(() => Promise.resolve(ok(paginaLlena(pagina++ * 100 + 1))));

    const { issues, truncated, ultimoUpdatedAt } = await fetchIssues(REF, TOKEN);

    expect(issues).toHaveLength(300);
    expect(truncated).toBe(true);
    // El último de la tercera página, no el instante de la llamada: los issues
    // que quedaron fuera se tocaron después de él, y avanzar hasta el arranque
    // es lo que hacía que no volvieran nunca.
    const ultimo = Date.UTC(2026, 0, 1) + 300 * 60_000;
    expect(ultimoUpdatedAt).toBe(ultimo);

    fetchMock.mockResolvedValue(ok([]));
    await fetchIssues(REF, TOKEN, ultimoUpdatedAt!);

    expect(fetchMock.mock.calls[3][0]).toContain(
      `since=${encodeURIComponent(new Date(ultimo).toISOString())}`,
    );
  });

  it("una página entera de pull requests mueve el cursor aunque no traiga ninguna tarea", async () => {
    fetchMock.mockResolvedValue(
      ok([rawIssue({ pull_request: { url: "..." }, updated_at: "2026-09-02T10:00:00Z" })]),
    );

    const { issues, ultimoUpdatedAt } = await fetchIssues(REF, TOKEN);

    expect(issues).toHaveLength(0);
    expect(ultimoUpdatedAt).toBe(Date.parse("2026-09-02T10:00:00Z"));
  });

  it("normaliza el milestone a la forma que usa el mapper", async () => {
    fetchMock.mockResolvedValue(
      ok([
        rawIssue({
          milestone: {
            id: 9,
            title: "Sprint 3",
            description: "meta",
            due_on: "2026-09-01T00:00:00Z",
            state: "open",
          },
        }),
      ]),
    );

    const { issues } = await fetchIssues(REF, TOKEN);

    expect(issues[0].milestone).toEqual({
      id: 9,
      title: "Sprint 3",
      description: "meta",
      dueOn: "2026-09-01T00:00:00Z",
      state: "open",
    });
  });
});
