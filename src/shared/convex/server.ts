import { auth } from "@clerk/nextjs/server";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { cache } from "react";
import type { Args } from "./loose";

/**
 * Convex desde un Server Component o una ruta, con la identidad de Clerk. El
 * token se pide una vez por request; sin sesión las funciones responden
 * `UNAUTHENTICATED` y el layout redirige a entrar.
 */
export const convexToken = cache(async (): Promise<string | undefined> => {
  const { getToken } = await auth();
  return (await getToken({ template: "convex" })) ?? undefined;
});

export async function serverQuery<Q extends FunctionReference<"query">>(query: Q, args: Args<Q>): Promise<FunctionReturnType<Q>> {
  return fetchQuery(query, args as FunctionArgs<Q>, { token: await convexToken() });
}

export async function serverMutation<M extends FunctionReference<"mutation">>(mutation: M, args: Args<M>): Promise<FunctionReturnType<M>> {
  return fetchMutation(mutation, args as FunctionArgs<M>, { token: await convexToken() });
}

export async function serverAction<A extends FunctionReference<"action">>(action: A, args: Args<A>): Promise<FunctionReturnType<A>> {
  return fetchAction(action, args as FunctionArgs<A>, { token: await convexToken() });
}
