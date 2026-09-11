"use client";

import { useSearchParams } from "next/navigation";

/** Cambia sólo el estado de la vista, sin volver a pedir la página al servidor. */
function pushViewParam(key: string, value: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get(key) === value) return;
  url.searchParams.set(key, value);
  window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/** La URL conserva la pestaña al abrir un enlace y al usar Atrás o Adelante. */
export function useUrlView<T extends string>(values: readonly T[], fallback: T) {
  const params = useSearchParams();
  const value = values.find((candidate) => candidate === params.get("view")) ?? fallback;
  function setValue(next: string) {
    if (values.some((candidate) => candidate === next)) pushViewParam("view", next);
  }
  return [value, setValue] as const;
}

/** Semana relativa de planificación; los enlaces malformados vuelven a esta semana. */
export function usePlanningWeek() {
  const params = useSearchParams();
  const raw = Number(params.get("week") ?? 0);
  const offset = Number.isInteger(raw) && Math.abs(raw) <= 520 ? raw : 0;
  function setOffset(next: number | ((previous: number) => number)) {
    pushViewParam("week", String(typeof next === "function" ? next(offset) : next));
  }
  return [offset, setOffset] as const;
}
