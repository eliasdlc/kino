import {
  GithubApiError,
  type GithubIssue,
  type GithubMilestone,
  type GithubRepoRef,
} from "./github-sync.types";

/**
 * Cliente HTTP mínimo de la API de GitHub. Sin SDK a propósito: sólo se usan
 * tres endpoints de lectura, y `@octokit/rest` son ~500 KB en el bundle de una
 * función serverless para eso.
 */

const API = "https://api.github.com";
const PER_PAGE = 100;

/**
 * Tope de páginas por sincronización. El free tier corta las funciones a 10s y
 * cada página es una ida y vuelta a GitHub: es mejor traer 300 issues y decir
 * que quedaron más que agotar el tiempo y morir a mitad sin avisar.
 */
const MAX_PAGES = 3;

interface RawIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  /** Presente sólo en pull requests. La API de issues las devuelve mezcladas. */
  pull_request?: unknown;
  milestone: RawMilestone | null;
}

interface RawMilestone {
  id: number;
  title: string;
  description: string | null;
  due_on: string | null;
  state: "open" | "closed";
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kino-app",
  };
}

async function request(path: string, token: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      headers: headers(token),
      cache: "no-store",
    });
  } catch (error) {
    throw new GithubApiError(
      `No se pudo contactar con GitHub: ${(error as Error).message}`,
      0,
      false,
    );
  }

  if (response.ok) return response;

  // 401 es token revocado o caducado. 403 con el remanente a cero es rate limit,
  // que no es culpa de la credencial y no debe pedir reconectar.
  const rateLimited =
    response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0";

  if (rateLimited) {
    throw new GithubApiError(
      "GitHub está limitando las peticiones. Inténtalo de nuevo en unos minutos.",
      response.status,
      false,
    );
  }

  const unauthorized = response.status === 401;
  const message = unauthorized
    ? "GitHub rechazó el token. Vuelve a conectar la cuenta."
    : response.status === 404
      ? "El repositorio no existe o la cuenta conectada no tiene acceso."
      : `GitHub respondió ${response.status}.`;

  throw new GithubApiError(message, response.status, unauthorized);
}

function toMilestone(raw: RawMilestone | null): GithubMilestone | null {
  if (!raw) return null;
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    dueOn: raw.due_on,
    state: raw.state,
  };
}

/** Login de la cuenta dueña del token. Sirve para confirmar que el token vale. */
export async function fetchViewerLogin(token: string): Promise<string> {
  const response = await request("/user", token);
  const data = (await response.json()) as { login: string };
  return data.login;
}

/**
 * Issues del repositorio, paginados.
 *
 * `state=all` a propósito: los cerrados también importan, porque son los que
 * mueven la tarjeta a la columna terminal. Filtrar sólo abiertos dejaría las
 * tarjetas de issues cerrados congeladas para siempre.
 *
 * Los pull requests se descartan: la API de issues los devuelve mezclados y una
 * PR no es una tarea del board.
 */
export async function fetchIssues(
  ref: GithubRepoRef,
  token: string,
): Promise<{ issues: GithubIssue[]; truncated: boolean }> {
  const issues: GithubIssue[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await request(
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}` +
        `/issues?state=all&per_page=${PER_PAGE}&page=${page}&sort=updated&direction=desc`,
      token,
    );
    const raw = (await response.json()) as RawIssue[];

    for (const item of raw) {
      if (item.pull_request) continue;
      issues.push({
        id: item.id,
        number: item.number,
        title: item.title,
        body: item.body,
        state: item.state,
        htmlUrl: item.html_url,
        milestone: toMilestone(item.milestone),
      });
    }

    if (raw.length < PER_PAGE) return { issues, truncated: false };
    if (page === MAX_PAGES) truncated = true;
  }

  return { issues, truncated };
}

/** Comprueba que el repositorio existe y que el token puede leerlo. */
export async function fetchRepoFullName(
  ref: GithubRepoRef,
  token: string,
): Promise<string> {
  const response = await request(
    `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
    token,
  );
  const data = (await response.json()) as { full_name: string };
  return data.full_name;
}
