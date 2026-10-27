/**
 * Criterio: la página de Tareas tiene dos vistas, Lista y Calendario, que el
 * segmento cambia y la URL recuerda (`?view=calendario`). La lista espera a sus
 * cuatro suscripciones (sugeridas, todas, ajustes y plan de hoy) y mientras
 * falte una enseña un solo esqueleto; con todas, entran las dos secciones a la vez.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery, type QueryStub } from "@/shared/testing/render";
import { TasksPageClient } from "./TasksPage";

// Next vuelve a leer `useSearchParams` cuando alguien empuja una URL; el mock
// compartido no, así que aquí se reparte el aviso del `pushState` real de jsdom.
vi.mock("next/navigation", async () => {
  const base = (await import("@/shared/testing/navigation")).navigationMock();
  const { useMemo, useSyncExternalStore } = await import("react");
  const subscribe = (aviso: () => void) => {
    window.addEventListener("kino-test-pushstate", aviso);
    return () => window.removeEventListener("kino-test-pushstate", aviso);
  };
  return {
    ...base,
    useSearchParams: () => {
      const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

// El calendario se carga aparte y trae la rejilla de la semana: aquí basta con
// saber que su sección se monta.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const pushState = window.history.pushState.bind(window.history);

beforeEach(() => {
  window.history.replaceState(null, "", "/tasks");
  window.history.pushState = (...args: Parameters<History["pushState"]>) => {
    pushState(...args);
    window.dispatchEvent(new Event("kino-test-pushstate"));
  };
});

afterEach(() => {
  window.history.pushState = pushState;
  window.history.replaceState(null, "", "/");
});

const suscripciones: Record<string, QueryStub> = {
  sugeridas: stubQuery(api.insights.suggest, []),
  todas: stubQuery(api.tasks.list, { items: [], restantes: 0 } as never),
  ajustes: stubQuery(api.settings.get, { dailyEnergyLimit: 10 } as never),
  plan: stubQuery(api.tasks.todayPlan, []),
};

function pintar(faltan: string[] = []) {
  const convex = makeTestConvexClient(Object.entries(suscripciones).filter(([k]) => !faltan.includes(k)).map(([, stub]) => stub));
  return { ...renderWithProviders(<TasksPageClient systems={[]} />, { convex }), convex };
}

describe("TasksPageClient", () => {
  it("el segmento pasa a Calendario y escribe view=calendario en la URL", () => {
    const { container } = pintar();
    const segmento = screen.getByRole("radiogroup", { name: "Vista de tareas" });
    expect(screen.getByRole("radio", { name: "Lista" })).toBeChecked();
    expect(screen.queryByRole("region", { name: "Calendario de tareas" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Calendario" }));

    expect(window.location.search).toBe("?view=calendario");
    expect(screen.getByRole("region", { name: "Calendario de tareas" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Calendario" })).toBeChecked();
    // La cabecera y el segmento se quedan donde estaban; sólo la lista se va.
    expect(segmento).toBeInTheDocument();
    expect(container.querySelector("[data-slot=lista-de-tareas-skeleton]")).toBeNull();
    expect(screen.queryByRole("region", { name: "Todas las tareas" })).toBeNull();
  });

  it("abrir la página con ?view=calendario muestra el calendario y Lista vuelve", () => {
    window.history.replaceState(null, "", "/tasks?view=calendario");
    pintar();
    expect(screen.getByRole("region", { name: "Calendario de tareas" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Lista" }));

    expect(window.location.search).toBe("?view=lista");
    expect(screen.queryByRole("region", { name: "Calendario de tareas" })).toBeNull();
    expect(screen.getByRole("region", { name: "Todas las tareas" })).toBeInTheDocument();
  });

  it.each([
    ["sugeridas", "lo sugerido"],
    ["todas", "todas las tareas"],
    ["ajustes", "los ajustes"],
    ["plan", "el plan de hoy"],
  ])("mientras falta %s (%s) la lista enseña el esqueleto y no las secciones", (falta) => {
    const { container } = pintar([falta]);

    expect(container.querySelector("[data-slot=lista-de-tareas-skeleton]")).not.toBeNull();
    // El esqueleto pinta los mismos títulos; lo que no tiene es la sección.
    expect(screen.queryByRole("region", { name: "Sugerido para hoy" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Todas las tareas" })).toBeNull();
  });

  it("al llegar la última suscripción el esqueleto da paso a las dos secciones", () => {
    const { container, convex } = pintar(["plan"]);
    expect(container.querySelector("[data-slot=lista-de-tareas-skeleton]")).not.toBeNull();

    act(() => convex.publish(suscripciones.plan!));

    expect(container.querySelector("[data-slot=lista-de-tareas-skeleton]")).toBeNull();
    expect(screen.getByRole("region", { name: "Sugerido para hoy" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Todas las tareas" })).toBeInTheDocument();
  });
});
