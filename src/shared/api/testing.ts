import { NextRequest } from "next/server";
import { apiHandler } from "./handler";

/**
 * Llama al contrato como lo haría un cliente: por su URL y su método.
 *
 * Lo usan los tests de cada slice para fijar el status y el cuerpo que la ruta
 * devolvía antes de entrar al contrato. Van por el handler entero a propósito —
 * llamar al procedimiento directamente se saltaría el routing, la validación de
 * la entrada y la traducción de los errores, que es justo lo que se comprueba.
 *
 * Quien lo use tiene que mockear `@/shared/utils/auth-context` y `@/shared/db`.
 */
export async function callApi(
  method: string,
  path: string,
  body?: unknown,
  /** Cuerpo crudo, para los casos que mandan algo que no es JSON válido. */
  raw?: string,
): Promise<{ status: number; body: unknown; text: string }> {
  const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
  const request = new NextRequest(`http://localhost/api${path}`, {
    method,
    ...(payload === undefined
      ? {}
      : { body: payload, headers: { "content-type": "application/json" } }),
  });

  const { matched, response } = await apiHandler.handle(request, {
    prefix: "/api",
    context: { request },
  });

  if (!matched || !response) {
    throw new Error(`El contrato no reclama ${method} ${path}`);
  }

  const text = await response.text();
  return {
    status: response.status,
    body: text.length > 0 ? JSON.parse(text) : undefined,
    text,
  };
}
