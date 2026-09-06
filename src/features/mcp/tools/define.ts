import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { z } from "zod";
import type { Loose } from "@/shared/convex/loose";

/**
 * Cómo una herramienta del MCP se convierte en una llamada a Convex.
 *
 * Una tool es una función de Convex con nombre y prosa para el agente. El
 * compilador exige que lo que sale del schema de entrada encaje en los
 * argumentos de la función, o que la tool declare `args` para adaptarlo. Así
 * cambiar una función de Convex deja de compilar la tool que la usa, en vez
 * de fallar en la primera llamada del agente.
 */

type Fn<K extends "query" | "mutation" = "query" | "mutation"> = FunctionReference<K>;

/** Ejecuta una función de Convex como el usuario del conector. Se inyecta para poder simular el backend en los tests. */
export type Call = <F extends Fn>(kind: F["_type"], fn: F, args: FunctionArgs<F>) => Promise<FunctionReturnType<F>>;

/** El `Call` real: cada llamada viaja con el token que la ruta firmó para Convex. */
export function convexCall(token: string): Call {
  return (kind, fn, args) =>
    kind === "query"
      ? fetchQuery(fn as Fn<"query">, args, { token })
      : fetchMutation(fn as Fn<"mutation">, args, { token });
}

type Input<S extends z.ZodRawShape> = z.output<z.ZodObject<S>>;
type ToArgs<F extends Fn, S extends z.ZodRawShape> = (input: Input<S>) => Loose<FunctionArgs<F>>;

type Spec<F extends Fn, S extends z.ZodRawShape> = {
  name: string;
  description: string;
  input: z.ZodObject<S>;
  /** Adapta la entrada a los argumentos de la función. Obligatorio si las formas no coinciden. */
  args?: ToArgs<F, S>;
  /** Ajusta el resultado antes de dárselo al agente. */
  result?: (value: FunctionReturnType<F>, input: Input<S>) => unknown;
} & (Input<S> extends Loose<FunctionArgs<F>> ? unknown : { args: ToArgs<F, S> });

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodObject<z.ZodRawShape>;
  /**
   * La función de Convex que hay detrás. Está aquí para que se pueda auditar
   * el catálogo sin ejecutarlo: `convex/reach.test.ts` la usa para comprobar
   * que ninguna tool publica una función cerrada.
   *
   * Ausente sólo en las secuencias de aprendizaje, que encadenan varias
   * funciones y no tienen una sola detrás. Ese test las nombra una a una para
   * que la excepción no crezca sin que nadie la vea.
   */
  readonly ref?: Fn;
  run(call: Call, input: Record<string, unknown>): Promise<unknown>;
}

function define<F extends Fn, S extends z.ZodRawShape>(kind: F["_type"], fn: F, spec: Spec<F, S>): Tool {
  return {
    name: spec.name,
    description: spec.description,
    input: spec.input,
    ref: fn,
    async run(call, raw) {
      const input = spec.input.parse(raw);
      const args = (spec.args ? spec.args(input) : input) as FunctionArgs<F>;
      const value = await call(kind, fn, args);
      return spec.result ? spec.result(value, input) : value;
    },
  };
}

/** Una tool que lee. */
export const readTool = <F extends Fn<"query">, S extends z.ZodRawShape>(fn: F, spec: Spec<F, S>) => define("query", fn, spec);

/** Una tool que escribe. */
export const writeTool = <F extends Fn<"mutation">, S extends z.ZodRawShape>(fn: F, spec: Spec<F, S>) => define("mutation", fn, spec);

/**
 * Lo que el agente lee cuando una llamada falla. Los códigos de Convex se
 * traducen a una frase que dice qué hacer, porque el agente se la repite al
 * usuario tal cual.
 */
export function describeError(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = (typeof error.data === "object" && error.data !== null ? error.data : {}) as Record<string, unknown>;
    switch (data.code) {
      case "UNAUTHENTICATED":
        return "La autorización del conector caducó. Vuelve a conectar Kino.";
      case "FORBIDDEN_SCOPE":
        return `Este conector tiene alcance "${String(data.granted)}" y esta herramienta exige "${String(data.required)}". Vuelve a autorizar Kino con más permisos.`;
      case "NO_USER":
        return "Esta cuenta todavía no tiene espacio en Kino: abre la app en el navegador y termina el onboarding.";
      case "NOT_FOUND":
      case "VALIDATION_ERROR":
      case "FORBIDDEN":
      case "CONFLICT":
        return `${String(data.code)}: ${String(data.message)}`;
    }
    if ("ZodError" in data) return `Argumentos inválidos: ${JSON.stringify(data.ZodError)}`;
    return typeof error.data === "string" ? error.data : JSON.stringify(error.data);
  }
  // Un argumento que no pasa el validador de Convex llega como error genérico
  // con un prefijo de servidor que al agente no le dice nada.
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^\[Request ID: [^\]]+\] Server Error\s*/, "");
}

function text(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

/** Monta las tools en el servidor. Cada llamada corre con el `Call` de la petición. */
export function registerTools(server: McpServer, call: Call, tools: readonly Tool[]): void {
  for (const tool of tools) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.input }, async (input) => {
      try {
        const value = await tool.run(call, input as Record<string, unknown>);
        return text(value ?? `${tool.name}: hecho.`);
      } catch (error) {
        return { ...text(describeError(error)), isError: true };
      }
    });
  }
}
