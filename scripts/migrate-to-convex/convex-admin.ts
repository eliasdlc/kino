// Llama funciones internas de un deployment con la clave de deploy, por la
// API HTTP de Convex. Es lo que `npx convex run` hace por dentro, sin
// levantar un proceso por lote.

export type ConvexAdmin = {
  query<T>(path: string, args?: Record<string, unknown>): Promise<T>;
  mutation<T>(path: string, args?: Record<string, unknown>): Promise<T>;
};

export function convexAdmin(url: string, deployKey: string): ConvexAdmin {
  async function call<T>(kind: 'query' | 'mutation', path: string, args: Record<string, unknown>) {
    const response = await fetch(`${url}/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Convex ${deployKey}` },
      body: JSON.stringify({ path, args, format: 'json' }),
    });
    const body = (await response.json()) as
      | { status: 'success'; value: T }
      | { status: 'error'; errorMessage: string; errorData?: unknown };
    if (body.status !== 'success') {
      throw new Error(`${path}: ${body.errorMessage}`);
    }
    return body.value;
  }
  return {
    query: (path, args = {}) => call('query', path, args),
    mutation: (path, args = {}) => call('mutation', path, args),
  };
}
