/**
 * Criterio: en el teléfono el calendario es la página del día. Las tareas con
 * hora se ven a cualquier hora, la tira de la semana, Hoy y las flechas mueven
 * el día que se mira, cada fila se completa o se mueve sin abrir el formulario
 * (y las dos cosas se deshacen 4 s) y la rejilla de escritorio (con @dnd-kit)
 * no se carga nunca, ni al hidratar.
 */
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays, endOfWeek, format, startOfToday, startOfWeek, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { describe, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { makeTask, mid } from "@/app/system-design/mock-data";
import { dayToLocalISO } from "@/features/tasks/tasks.utils";
import { makeTestConvexClient, renderMobile, renderWithProviders, stubQuery } from "@/shared/testing/render";
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

  it("a 320 px la hora del margen se lee 09:00 de una pieza, en mute y tabular, y la semana trae siete días de 2.85rem", () => {
    window.innerWidth = 320;
    const tareas = [makeTask({ id: mid("cal-320"), title: "Leer el capítulo cuatro", dueDate: hoyALas(9) })];
    renderWithProviders(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, tareas)]),
    });

    const hora = document.querySelector('[data-slot="hora"]')!;
    expect(hora).toHaveTextContent(/^09:00$/);
    expect(hora).toHaveClass("text-muted-foreground", "tabular-nums", "whitespace-nowrap");
    expect(hora).not.toHaveClass("text-[0.8rem]");
    const dias = within(screen.getByRole("navigation", { name: "Días de la semana" })).getAllByRole("button");
    expect(dias).toHaveLength(7);
    dias.forEach((d) => expect(d).toHaveClass("min-w-[2.85rem]"));
    expect(dndCargado).not.toHaveBeenCalled();
  });

  it("la duración de la meta no parte la cifra de su unidad en un ancho estrecho", () => {
    const tareas = [makeTask({ id: mid("cal-dur"), title: "Leer el capítulo cuatro", dueDate: hoyALas(9), estimatedTime: "01:00" })];
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, tareas)]),
    });

    // Leído del texto sin normalizar: las consultas de Testing Library tratan
    // el espacio duro como un espacio cualquiera.
    const fila = screen.getByRole("button", { name: /^09:00, Leer el capítulo cuatro/ });
    expect(fila.textContent).toContain("1\u00a0h");
  });

  it("un título largo no pasa de tres renglones en la fila, y el detalle lo lleva entero", () => {
    const largo = "Leer el capítulo 4 de Tanenbaum: planificación de procesos, hilos y la parte de interbloqueos";
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [makeTask({ id: mid("cal-largo"), title: largo, dueDate: hoyALas(8) })])]),
    });

    const fila = screen.getByRole("button", { name: new RegExp(`^08:00, ${largo}`) });
    expect(within(fila).getByText(largo)).toHaveClass("line-clamp-3");
  });

  it("no carga @dnd-kit ni la rejilla de escritorio, tampoco al hidratar", () => {
    // La hidratación usa la instantánea del servidor: si esa dijera
    // "escritorio", el teléfono pintaría la rejilla antes de saltar. Para que
    // React hidrate de verdad (y no se rinda ante un contenedor vacío y pinte
    // en el cliente) el contenedor lleva el HTML que el servidor serviría al
    // teléfono: el de un primer pintado de móvil.
    // El servidor no tiene datos todavía: su HTML es el de las consultas en carga.
    const servido = renderMobile(<GlobalCalendarView />, { convex: makeTestConvexClient([]) });
    const html = servido.container.innerHTML;
    servido.unmount();
    const contenedor = document.body.appendChild(document.createElement("div"));
    contenedor.innerHTML = html;
    const noCoincide = vi.fn();

    renderMobile(<GlobalCalendarView />, {
      container: contenedor,
      hydrate: true,
      onRecoverableError: noCoincide,
      convex: makeTestConvexClient([]),
    });

    expect(noCoincide).not.toHaveBeenCalled();
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

    await userEvent.click(screen.getByRole("button", { name: /^09:00, Repasar la escena/ }));

    expect(await screen.findByRole("dialog", { name: "Tarea" })).toBeVisible();
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
    expect(toastSpy).toHaveBeenLastCalledWith(expect.stringMatching(/^Corregir pruebas, a las 16:00 del /), expect.anything());
  });

  it("mover ofrece Deshacer 4 s y deshacer devuelve la hora y el día de antes", async () => {
    const tarea = makeTask({ id: mid("cal-9"), title: "Pasar las notas", startDate: hoyALas(9), dueDate: null });
    const { convex } = renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [tarea])]),
    });

    await userEvent.click(screen.getByRole("button", { name: "Mover Pasar las notas" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Mover" })).getByRole("button", { name: /Todo el día/ }));

    const opciones = toastSpy.mock.calls.at(-1)?.[1] as unknown as { duration: number; action: { label: string; onClick: () => void } } | undefined;
    expect(opciones?.duration).toBe(4000);
    expect(opciones?.action.label).toBe("Deshacer");
    act(() => opciones!.action.onClick());
    expect(convex.calls.filter((c) => c.name === "tasks:update").at(-1)).toEqual({
      kind: "mutation",
      name: "tasks:update",
      args: { id: tarea.id, startDate: hoyALas(9), dueDate: null },
    });
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

describe("GlobalCalendarView en el teléfono, el día que se mira", () => {
  /** Una tarea sin hora en el día dado: el día pelado a medianoche local, como lo guarda la app. */
  const delDia = (dia: Date) => dayToLocalISO(dayKey(dia));

  it("al cambiar de día la lista es la de ese día, con hora y de todo el día", async () => {
    const hoy = startOfToday();
    const otro = addDays(hoy, 7);
    const tareas = [
      makeTask({ id: mid("dia-1"), title: "Con hora de hoy", dueDate: hoyALas(9) }),
      makeTask({ id: mid("dia-2"), title: "Todo el día de hoy", dueDate: delDia(hoy) }),
      makeTask({
        id: mid("dia-3"),
        title: "Con hora de la otra semana",
        dueDate: new Date(otro.getFullYear(), otro.getMonth(), otro.getDate(), 10).toISOString(),
      }),
      makeTask({ id: mid("dia-4"), title: "Todo el día de la otra semana", dueDate: delDia(otro) }),
    ];
    renderMobile(<GlobalCalendarView />, { convex: makeTestConvexClient([stubQuery(api.tasks.calendar, tareas)]) });
    expect(screen.getByText("Con hora de hoy")).toBeVisible();
    expect(screen.getByText("Todo el día de hoy")).toBeVisible();
    expect(screen.queryByText(/de la otra semana/)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));

    expect(screen.getByText("Con hora de la otra semana")).toBeVisible();
    expect(screen.getByText("Todo el día de la otra semana")).toBeVisible();
    expect(screen.queryByText(/de hoy/)).toBeNull();
  });

  it("al pasar a otra semana se pregunta por esa semana, no por la de hoy", async () => {
    const convex = makeTestConvexClient([stubQuery(api.tasks.calendar, [])]);
    renderMobile(<GlobalCalendarView />, { convex });
    const semana = (dia: Date) => ({
      from: startOfWeek(dia, { weekStartsOn: 1 }).toISOString(),
      to: endOfWeek(dia, { weekStartsOn: 1 }).toISOString(),
    });
    expect(convex.watched.filter((w) => w.name === "tasks:calendar").at(-1)?.args).toEqual(semana(startOfToday()));

    await userEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));

    const calendario = convex.watched.filter((w) => w.name === "tasks:calendar");
    expect(calendario.at(-1)?.args).toEqual(semana(addDays(startOfToday(), 7)));
  });

  it("programar escribe el día que se mira, no hoy", async () => {
    const suelta = makeTask({ id: mid("dia-5"), title: "Escribir la sinopsis" });
    const { convex } = renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([
        stubQuery(api.tasks.calendar, []),
        stubQuery(api.tasks.list, { items: [suelta], restantes: 0 }),
      ]),
    });
    const otro = addDays(startOfToday(), 7);

    await userEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    await userEvent.click(screen.getByRole("button", { name: /Sin programar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Programar Escribir la sinopsis" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Programar" })).getByRole("button", { name: "15:00" }));

    expect(convex.calls).toEqual([
      { kind: "mutation", name: "tasks:update", args: { id: suelta.id, startDate: dayToLocalISO(dayKey(otro), "15:00") } },
    ]);
  });

  it("mientras la semana no llega pinta el esqueleto, no «Nada con fecha este día», y al llegar lo cambia", () => {
    const convex = makeTestConvexClient([]);
    renderMobile(<GlobalCalendarView />, { convex });

    expect(screen.queryByText("Nada con fecha este día")).toBeNull();
    expect(document.querySelectorAll('[data-slot="page"] [data-slot="skeleton"]').length).toBeGreaterThan(0);

    act(() => convex.publish(stubQuery(api.tasks.calendar, [])));
    act(() => convex.publish(stubQuery(api.tasks.list, { items: [], restantes: 0 })));

    expect(screen.getByText("Nada con fecha este día")).toBeVisible();
    expect(document.querySelectorAll('[data-slot="page"] [data-slot="skeleton"]').length).toBe(0);
  });

  it("mientras la lista de las sin fecha no llega no dice 0 ni «ya tiene fecha», y al llegar sí", async () => {
    const convex = makeTestConvexClient([stubQuery(api.tasks.calendar, [])]);
    renderMobile(<GlobalCalendarView />, { convex });
    const cabecera = screen.getByRole("button", { name: /Sin programar/ });

    await userEvent.click(cabecera);

    expect(screen.queryByText("Todo lo pendiente ya tiene fecha.")).toBeNull();
    expect(cabecera.textContent).toBe("Sin programar");
    const lista = document.getElementById(cabecera.getAttribute("aria-controls")!)!;
    expect(lista.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    // Quieto: un esqueleto que late no es una carga, es una distracción.
    expect(lista.querySelector('[class*="animate-"]')).toBeNull();

    act(() => convex.publish(stubQuery(api.tasks.list, { items: [], restantes: 0 })));

    expect(screen.getByText("Todo lo pendiente ya tiene fecha.")).toBeVisible();
    expect(cabecera.textContent).toBe("Sin programar0");
    expect(lista.querySelectorAll('[data-slot="skeleton"]').length).toBe(0);
  });

  it("los puntos de la tira cuentan las tareas con hora y las de todo el día", () => {
    const hoy = startOfToday();
    const manana = addDays(hoy, 1);
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([
        stubQuery(api.tasks.calendar, [
          makeTask({ id: mid("punto-1"), title: "Con hora", dueDate: hoyALas(9) }),
          makeTask({ id: mid("punto-2"), title: "Con otra hora", dueDate: hoyALas(14) }),
          makeTask({ id: mid("punto-3"), title: "Una más", dueDate: hoyALas(18) }),
          makeTask({ id: mid("punto-4"), title: "Todo el día de mañana", dueDate: dayToLocalISO(dayKey(manana)) }),
        ]),
      ]),
    });
    const tira = within(screen.getByRole("navigation", { name: "Días de la semana" }));

    // Tres con hora y ninguna de todo el día: «tres o más», no «sin nada».
    expect(tira.getByRole("button", { name: `${fechaDe(hoy)}, tres o más con fecha` })).toBeVisible();
    expect(tira.getByRole("button", { name: `${fechaDe(manana)}, 1 con fecha` })).toBeVisible();
  });

  it("una tarea hecha no ofrece Mover, y una pendiente con hora sí", () => {
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([
        stubQuery(api.tasks.calendar, [
          makeTask({ id: mid("mov-1"), title: "Ya entregada", dueDate: hoyALas(9), status: "done" }),
          makeTask({ id: mid("mov-2"), title: "Por entregar", dueDate: hoyALas(10) }),
        ]),
      ]),
    });

    expect(screen.queryByRole("button", { name: "Mover Ya entregada" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mover Por entregar" })).toBeVisible();
  });

  it("el nombre de la fila dice también si está hecha, vencida o crítica", async () => {
    const tareas = [
      makeTask({ id: mid("dia-6"), title: "Entregar el informe", dueDate: hoyALas(9), status: "done", effectivePriority: "critical" }),
      makeTask({ id: mid("dia-7"), title: "Pagar la matrícula", dueDate: subDays(new Date(), 7).toISOString() }),
    ];
    renderMobile(<GlobalCalendarView />, { convex: makeTestConvexClient([stubQuery(api.tasks.calendar, tareas)]) });

    expect(screen.getByRole("button", { name: /^09:00, Entregar el informe, hecha, crítica/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Semana anterior" }));

    expect(screen.getByRole("button", { name: /, Pagar la matrícula, vencida/ })).toBeVisible();
  });
});
