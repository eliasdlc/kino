/**
 * Criterio: en el teléfono el calendario es la página del día. Las tareas con
 * hora se ven a cualquier hora, la tira de la semana, Hoy y las flechas mueven
 * el día que se mira, cada fila se completa o se mueve sin abrir el formulario
 * y la rejilla de escritorio (con @dnd-kit) no se carga nunca, ni al hidratar.
 */
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays, format, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { describe, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { makeTask, mid } from "@/app/system-design/mock-data";
import { dayToLocalISO } from "@/features/tasks/tasks.utils";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { dayKey } from "./calendar.layout";
import { GlobalCalendarView } from "./GlobalCalendarView";

const dndCargado = vi.hoisted(() => vi.fn());
vi.mock("@dnd-kit/core", async (original) => {
  dndCargado();
  return original();
});

const toastSpy = vi.hoisted(() => Object.assign(vi.fn<(...args: unknown[]) => string>(() => "aviso"), { dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastSpy }));

function hoyALas(hora: number, minutos = 0): string {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hora, minutos).toISOString();
}

/** La fecha que el teléfono anuncia en su línea viva, "miércoles 22 de octubre". */
function fechaDe(dia: Date): string {
  return format(dia, "EEEE d 'de' MMMM", { locale: es });
}

function lineaViva(): HTMLElement {
  return screen.getByText((_, el) => el?.getAttribute("aria-live") === "polite" && el.tagName === "P");
}

describe("GlobalCalendarView en el teléfono", () => {
  it("pinta las tareas con hora del día, dentro y fuera de 06:00 a 22:00", () => {
    const tareas = [
      makeTask({ id: mid("cal-1"), title: "Revisar el capítulo tres", dueDate: hoyALas(10, 30) }),
      makeTask({ id: mid("cal-2"), title: "Llamar antes de dormir", dueDate: hoyALas(23, 15) }),
      makeTask({ id: mid("cal-3"), title: "Correr temprano", startDate: hoyALas(5, 45) }),
    ];
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, tareas)]),
    });

    expect(screen.getByText(/Revisar el capítulo tres/)).toBeVisible();
    expect(screen.getByText(/Llamar antes de dormir/)).toBeVisible();
    expect(screen.getByText(/Correr temprano/)).toBeVisible();
  });

  it("no carga @dnd-kit ni la rejilla de escritorio, tampoco al hidratar", () => {
    // La hidratación usa la instantánea del servidor: si esa dijera
    // "escritorio", el teléfono pintaría la rejilla antes de saltar. El
    // contenedor llega vacío, así que React avisa del desajuste y vuelve a
    // pintar en el cliente: ese aviso es el esperado y se calla aquí.
    const contenedor = document.body.appendChild(document.createElement("div"));
    renderMobile(<GlobalCalendarView />, {
      container: contenedor,
      hydrate: true,
      onRecoverableError: () => {},
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [])]),
    });

    expect(screen.getByRole("heading", { level: 1, name: "Calendario" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Vista" })).not.toBeInTheDocument();
    expect(dndCargado).not.toHaveBeenCalled();
  });
});

describe("GlobalCalendarView en el teléfono, la semana", () => {
  it("tocar un día de la tira lo elige y lo anuncia", async () => {
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [])]),
    });
    const tira = screen.getByRole("navigation", { name: "Días de la semana" });
    const otro = within(tira)
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-pressed") === "false")!;

    await userEvent.click(otro);

    expect(otro).toHaveAttribute("aria-pressed", "true");
    expect(within(tira).getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(lineaViva()).toHaveTextContent(otro.getAttribute("aria-label")!.split(",")[0]!);
  });

  it("las flechas mueven siete días y Hoy vuelve a hoy desde otra semana", async () => {
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [])]),
    });
    const hoy = startOfToday();

    await userEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(lineaViva()).toHaveTextContent(fechaDe(addDays(hoy, 7)));

    await userEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    await userEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(lineaViva()).toHaveTextContent(fechaDe(addDays(hoy, -7)));

    await userEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(lineaViva()).toHaveTextContent(fechaDe(hoy));
  });
});

describe("GlobalCalendarView en el teléfono, las operaciones", () => {
  it("tocar una tarea con hora abre su detalle", async () => {
    const tarea = makeTask({ id: mid("cal-4"), title: "Repasar la escena", dueDate: hoyALas(9) });
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [tarea])]),
    });

    await userEvent.click(screen.getByRole("button", { name: "09:00, Repasar la escena" }));

    expect(await screen.findByRole("dialog", { name: "Editar tarea" })).toBeVisible();
  });

  it("el círculo de la fila la completa y ofrece Deshacer 4 s", async () => {
    const tarea = makeTask({ id: mid("cal-6"), title: "Enviar el capítulo", dueDate: hoyALas(11) });
    const { convex } = renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [tarea])]),
    });

    await userEvent.click(screen.getByRole("button", { name: "Completar Enviar el capítulo" }));

    expect(convex.calls).toContainEqual({ kind: "mutation", name: "tasks:toggle", args: { id: tarea.id } });
    const opciones = toastSpy.mock.calls.at(-1)?.[1] as unknown as { duration: number; action: { label: string; onClick: () => void } };
    expect(opciones.duration).toBe(4000);
    expect(opciones.action.label).toBe("Deshacer");
    act(() => opciones.action.onClick());
    expect(convex.calls.filter((c) => c.name === "tasks:toggle")).toHaveLength(2);
  });

  it("mover una con fecha usa la misma hoja y escribe su nueva hora", async () => {
    const tarea = makeTask({ id: mid("cal-7"), title: "Corregir pruebas", startDate: hoyALas(9) });
    const { convex } = renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [tarea])]),
    });

    await userEvent.click(screen.getByRole("button", { name: "Mover Corregir pruebas" }));
    const hoja = await screen.findByRole("dialog", { name: "Mover" });
    await userEvent.click(within(hoja).getByRole("button", { name: "16:00" }));

    expect(convex.calls).toContainEqual({ kind: "mutation", name: "tasks:update", args: { id: tarea.id, startDate: hoyALas(16) } });
    expect(toastSpy).toHaveBeenLastCalledWith(expect.stringMatching(/^Corregir pruebas, a las 16:00 del /));
  });

  it("programar una sin fecha a una hora escribe su inicio en el día que se mira", async () => {
    const suelta = makeTask({ id: mid("cal-5"), title: "Escribir la sinopsis" });
    const { convex } = renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([
        stubQuery(api.tasks.calendar, []),
        stubQuery(api.tasks.list, { items: [suelta], restantes: 0 }),
      ]),
    });

    await userEvent.click(screen.getByRole("button", { name: /Sin programar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Programar Escribir la sinopsis" }));
    const hoja = await screen.findByRole("dialog", { name: "Programar" });
    await userEvent.click(within(hoja).getByRole("button", { name: "15:00" }));

    expect(convex.calls).toEqual([
      { kind: "mutation", name: "tasks:update", args: { id: suelta.id, startDate: hoyALas(15) } },
    ]);
  });

  it("programar todo el día deja la tarea sin hora en el día que se mira", async () => {
    const suelta = makeTask({ id: mid("cal-8"), title: "Leer el capítulo cuatro" });
    const { convex } = renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([
        stubQuery(api.tasks.calendar, []),
        stubQuery(api.tasks.list, { items: [suelta], restantes: 0 }),
      ]),
    });

    await userEvent.click(screen.getByRole("button", { name: /Sin programar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Programar Leer el capítulo cuatro" }));
    const hoja = await screen.findByRole("dialog", { name: "Programar" });
    await userEvent.click(within(hoja).getByRole("button", { name: /Todo el día/ }));

    expect(convex.calls).toEqual([
      {
        kind: "mutation",
        name: "tasks:update",
        args: { id: suelta.id, startDate: null, dueDate: dayToLocalISO(dayKey(startOfToday())) },
      },
    ]);
  });

  it("un día sin nada lo dice, sin rejilla de horas, y lleva a las que no tienen fecha", async () => {
    const suelta = makeTask({ id: mid("cal-9"), title: "Ordenar las notas" });
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([
        stubQuery(api.tasks.calendar, []),
        stubQuery(api.tasks.list, { items: [suelta], restantes: 0 }),
      ]),
    });

    expect(screen.getByRole("heading", { name: "Nada con fecha este día" })).toBeVisible();
    expect(screen.queryByText("06:00")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ver la que no tiene fecha" }));

    expect(screen.getByRole("button", { name: /Sin programar/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Ordenar las notas")).toBeVisible();
  });
});
