import type { OptimisticLocalStore } from "convex/browser";
import { api } from "@convex/_generated/api";

/**
 * Completar es optimista: el círculo se rellena en el mismo toque y el
 * servidor sólo confirma. Convex aplica esta reescritura a las queries locales
 * en el tick de la llamada y la deshace sola si la mutación falla, así que no
 * hay estado que limpiar a mano.
 *
 * Reescribe la tarea en cada lista que la puede pintar: la de /tasks, el plan
 * de hoy, lo sugerido, las de sistema y carpeta, el calendario y las
 * subtareas. Completar la pasa a `done`; deshacer la devuelve a `today`, que
 * es lo que hace la máquina de estados del servidor (`undo_done`).
 */

interface Toggleable {
  id: string;
  status: string;
  completedAt: string | null;
}

function flip<T extends Toggleable>(id: string, now: string) {
  return (task: T): T => {
    if (task.id !== id) return task;
    const done = task.status === "done";
    return { ...task, status: done ? "today" : "done", completedAt: done ? null : now } as T;
  };
}

export function toggleLocally(localStore: OptimisticLocalStore, { id }: { id: string }) {
  const now = new Date().toISOString();

  for (const { args, value } of localStore.getAllQueries(api.tasks.list)) {
    if (value) localStore.setQuery(api.tasks.list, args, { ...value, items: value.items.map(flip(id, now)) });
  }
  for (const { args, value } of localStore.getAllQueries(api.tasks.todayPlan)) {
    if (value) localStore.setQuery(api.tasks.todayPlan, args, value.map(flip(id, now)));
  }
  for (const { args, value } of localStore.getAllQueries(api.tasks.bySystem)) {
    if (value) localStore.setQuery(api.tasks.bySystem, args, value.map(flip(id, now)));
  }
  for (const { args, value } of localStore.getAllQueries(api.tasks.byFolder)) {
    if (value) localStore.setQuery(api.tasks.byFolder, args, value.map(flip(id, now)));
  }
  for (const { args, value } of localStore.getAllQueries(api.tasks.calendar)) {
    if (value) localStore.setQuery(api.tasks.calendar, args, value.map(flip(id, now)));
  }
  for (const { args, value } of localStore.getAllQueries(api.tasks.subtasks)) {
    if (value) localStore.setQuery(api.tasks.subtasks, args, value.map(flip(id, now)));
  }
  for (const { args, value } of localStore.getAllQueries(api.insights.suggest)) {
    if (value) localStore.setQuery(api.insights.suggest, args, value.map(flip(id, now)));
  }
}
