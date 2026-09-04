import type { FunctionArgs, FunctionReference } from "convex/server";
import type { Id, TableNames } from "@convex/_generated/dataModel";

/**
 * Los argumentos de una función con los ids como `string` llano. Los
 * componentes reciben ids desde la URL y desde las props sin la marca de
 * tabla; la función los valida al llegar, así que aquí no hace falta el brand.
 */
export type Loose<T> = T extends Id<TableNames>
  ? string
  : T extends (infer U)[]
    ? Loose<U>[]
    : T extends object
      ? { [K in keyof T]: Loose<T[K]> }
      : T;

export type Args<F extends FunctionReference<"query" | "mutation" | "action">> = Loose<FunctionArgs<F>>;

