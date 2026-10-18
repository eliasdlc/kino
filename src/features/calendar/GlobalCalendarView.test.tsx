import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import { makeTask, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { GlobalCalendarView } from "./GlobalCalendarView";

/**
 * Criterio: en el teléfono, una tarea con hora se ve en el día que se mira,
 * también si su hora cae fuera de la rejilla de escritorio (06:00 a 22:00).
 * Antes la vista móvil buscaba `día:hora` en un mapa indexado sólo por día,
 * así que ninguna tarea con hora aparecía en ninguna parte.
 */

function hoyALas(hora: number, minutos = 0): string {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hora, minutos).toISOString();
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
});

describe("GlobalCalendarView en el teléfono, las operaciones", () => {
  /*
   * Criterio: el teléfono no arrastra. Tocar una fila con hora abre el
   * detalle de la tarea, y una sin fecha se programa con una hoja con nombre
   * que escribe lo mismo que soltarla en un hueco de escritorio.
   */
  it("tocar una tarea con hora abre su detalle", async () => {
    const tarea = makeTask({ id: mid("cal-4"), title: "Repasar la escena", dueDate: hoyALas(9) });
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [tarea])]),
    });

    await userEvent.click(screen.getByRole("button", { name: "09:00, Repasar la escena" }));

    expect(await screen.findByRole("dialog", { name: "Editar tarea" })).toBeVisible();
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

  it("un día sin nada lo dice, sin rejilla de horas vacías", () => {
    renderMobile(<GlobalCalendarView />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.calendar, [])]),
    });

    expect(screen.getByRole("heading", { name: "Nada con fecha este día" })).toBeVisible();
    expect(screen.queryByText("06:00")).not.toBeInTheDocument();
  });
});
