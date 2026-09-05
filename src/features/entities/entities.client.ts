import { api } from "@convex/_generated/api";
import { getConvexClient } from "@/shared/convex/client";
import type { CreateEntityBody } from "./entities.hooks";

// Llamadas a Convex desde fuera de React: las extensiones del editor no pueden
// usar hooks, así que hablan con el cliente directamente.

export const fetchSystemEntities = (systemId: string) =>
  getConvexClient().query(api.entities.bySystem, { systemId: systemId as never });

export const createEntityApi = (systemId: string, body: CreateEntityBody) =>
  getConvexClient().mutation(api.entities.create, { ...body, systemId: systemId as never });

export type { CreateEntityBody };
