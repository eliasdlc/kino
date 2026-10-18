/**
 * Criterio: completar es optimista. La reescritura local pasa la tarea a
 * hecha en todas las listas que la pintan (la de /tasks, el plan de hoy, lo
 * sugerido) en el mismo tick, y deshacer la devuelve a `today`, como la
 * máquina de estados del servidor. Las demás tareas no se tocan.
 */
import { describe, expect, it } from "vitest";
import { getFunctionName } from "convex/server";
import type { OptimisticLocalStore } from "convex/browser";
import { api } from "@convex/_generated/api";
import { toggleLocally } from "./tasks.optimistic";

function almacen(inicial: Record<string, unknown>) {
  const datos = new Map(Object.entries(inicial));
  const store = {
    getAllQueries: (q: Parameters<typeof getFunctionName>[0]) => {
      const nombre = getFunctionName(q);
      return datos.has(nombre) ? [{ args: {}, value: datos.get(nombre) }] : [];
    },
    setQuery: (q: Parameters<typeof getFunctionName>[0], _args: unknown, value: unknown) => {
      datos.set(getFunctionName(q), value);
    },
    getQuery: () => undefined,
  } as unknown as OptimisticLocalStore;
  return { store, leer: (q: Parameters<typeof getFunctionName>[0]) => datos.get(getFunctionName(q)) };
}

const t = (id: string, status: string) => ({ id, status, completedAt: null });

describe("toggleLocally", () => {
  it("tacha la tarea en la lista, el plan y lo sugerido, y deja las demás", () => {
    const { store, leer } = almacen({
      [getFunctionName(api.tasks.list)]: { items: [t("a", "week"), t("b", "today")], restantes: 0 },
      [getFunctionName(api.tasks.todayPlan)]: [t("a", "week")],
      [getFunctionName(api.insights.suggest)]: [t("a", "week")],
    });
    toggleLocally(store, { id: "a" });
    const lista = leer(api.tasks.list) as { items: { id: string; status: string; completedAt: string | null }[] };
    expect(lista.items[0]).toMatchObject({ id: "a", status: "done" });
    expect(lista.items[0]!.completedAt).not.toBeNull();
    expect(lista.items[1]).toMatchObject({ id: "b", status: "today" });
    expect((leer(api.tasks.todayPlan) as { status: string }[])[0]!.status).toBe("done");
    expect((leer(api.insights.suggest) as { status: string }[])[0]!.status).toBe("done");
  });

  it("deshacer la devuelve a hoy, sin fecha de cierre", () => {
    const { store, leer } = almacen({ [getFunctionName(api.tasks.todayPlan)]: [{ id: "a", status: "done", completedAt: "2026-10-18T10:00:00.000Z" }] });
    toggleLocally(store, { id: "a" });
    expect((leer(api.tasks.todayPlan) as unknown[])[0]).toMatchObject({ status: "today", completedAt: null });
  });
});
