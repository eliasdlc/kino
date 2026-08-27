import * as Sentry from "@sentry/nextjs";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError, ORPCError, ValidationError } from "@orpc/server";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import type { SchemaIssue } from "@orpc/contract";
import { apiRouter } from "./router";

/**
 * El cuerpo de un error, con la forma que el frontend y el MCP ya esperaban.
 *
 * oRPC serializa sus errores como `{ defined, code, status, message, data }`, y
 * cambiar eso rompería a todos los clientes vivos a la vez. Aquí se traduce a
 * `{ code, message, ...datos }`, que es lo que `route()` devolvía.
 */
function encodeErrorBody(error: ORPCError<string, unknown>): unknown {
  // La validación de entrada de oRPC es un BAD_REQUEST con las incidencias del
  // schema dentro. Sale como el 400 de siempre: mismo código, mismo mensaje.
  if (error.code === "BAD_REQUEST" && error.cause instanceof ValidationError) {
    return {
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: flattenIssues(error.cause.issues),
    };
  }

  // oRPC llama al error genérico INTERNAL_SERVER_ERROR; el contrato lo llama
  // INTERNAL_ERROR desde antes.
  const code = error.code === "INTERNAL_SERVER_ERROR" ? "INTERNAL_ERROR" : error.code;
  const extra =
    error.data !== null && typeof error.data === "object" ? error.data : undefined;

  return { code, message: error.message, ...extra };
}

/**
 * Las incidencias de un schema con la forma de `ZodError.flatten()`, que es la
 * que devuelven las rutas que todavía no están en el contrato. Mientras las dos
 * formas convivan, un 400 tiene que leerse igual venga de donde venga.
 */
function flattenIssues(issues: readonly SchemaIssue[]) {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const segment = issue.path?.[0];
    // Un tramo del path es una clave o un objeto que la envuelve, según la
    // librería de schema. Las dos formas son válidas en Standard Schema.
    const key =
      segment === undefined
        ? undefined
        : typeof segment === "object" && segment !== null
          ? String(segment.key)
          : String(segment);

    if (key === undefined) formErrors.push(issue.message);
    else (fieldErrors[key] ??= []).push(issue.message);
  }

  return { formErrors, fieldErrors };
}

export const apiHandler = new OpenAPIHandler(apiRouter, {
  customErrorResponseBodyEncoder: encodeErrorBody,
  // Un handler devuelve datos, no una `Response`, así que las cabeceras que
  // alguna operación necesita fijar —las cookies que Better Auth emite al
  // cambiar la contraseña o borrar la cuenta— se escriben en `context.resHeaders`.
  plugins: [new ResponseHeadersPlugin()],
  interceptors: [
    onError((error) => {
      // Sólo lo inesperado. Un 404 o un 422 son respuestas, no incidentes, y
      // llenar el log con ellos es la forma de dejar de leerlo.
      const status = error instanceof ORPCError ? error.status : 500;
      if (status < 500) return;
      Sentry.captureException(error, { tags: { layer: "api" } });
      console.error("[api] unhandled error:", error);
    }),
  ],
});
