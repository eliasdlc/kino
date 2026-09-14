"use client";

import { useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useConvexQuery } from "@/shared/convex/hooks";
import { resolveSelectedCycle } from "./academic-cycles";

export { resolveSelectedCycle };

export type AcademicPeriod = FunctionReturnType<typeof api.academicPeriods.list>[number];

/**
 * Los ciclos de un sistema. La cabecera y el proveedor de scope la leen los
 * dos: Convex comparte una sola suscripción entre consumidores con los mismos
 * argumentos, así que esto no dobla el tráfico.
 */
export function useAcademicPeriods(systemId: string, initialData?: AcademicPeriod[], enabled = true) {
  return useConvexQuery(api.academicPeriods.list, { systemId }, { initialData, enabled });
}

/** Cambia el ciclo sin pedirle la página al servidor. */
export function chooseCycle(periodId: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.set("cycle", periodId ?? "unassigned");
  window.history.pushState(null, "", `${url.pathname}${url.search}`);
}

/** El ciclo seleccionado y la lista completa, para la cabecera y el scope. */
export function useSelectedCycle(systemId: string, initialData?: AcademicPeriod[], enabled = true) {
  const params = useSearchParams();
  const { data: periods, isLoading } = useAcademicPeriods(systemId, initialData, enabled);
  const list = periods ?? [];
  const selectedId = resolveSelectedCycle(list, params.get("cycle"));
  return { periods: list, selectedId, selected: list.find((period) => period._id === selectedId) ?? null, isLoading };
}
