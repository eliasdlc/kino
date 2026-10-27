/**
 * El test de equivalencia entre la superficie de escritorio y la del teléfono,
 * y vive fuera del slice de escritura a propósito: el único que había,
 * `PlotSceneList.test.tsx`, se va con la extracción, y si se fuera antes de que
 * existiera este el rework se quedaría sin ninguno.
 *
 * La equivalencia se prueba donde de verdad existe: los dos caminos entran por
 * `boardMoveTarget`, así que la guarda de "mover a donde ya está" es una sola y
 * no dos copias que se desincronizan. El arrastre no se simula aquí porque
 * dnd-kit resuelve colisiones con medidas de layout que jsdom no da; lo que sí
 * se prueba entero es el camino con nombre, que es el que nace hoy. El ticket
 * es la fila de tarea común: con el dedo, "Más acciones" abre la hoja de la
 * fila y "Mover a otra columna" abre la de las columnas.
 */
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTask, mid, MOCK_SYSTEM_ID } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { conDedo } from "@/features/tasks/puntero.testing";
import { ProjectBoard, boardMoveTarget } from "./ProjectBoard";

const EN_PROGRESO = makeTask({
  id: mid("card-1"),
  title: "Diagrama ER de la tesis",
  boardStatus: "in_progress",
});

/** Una tarjeta sin `boardStatus`: cae en la primera columna por defecto. */
const SIN_COLUMNA = makeTask({ id: mid("card-2"), title: "Revisar la rúbrica", boardStatus: null });

function pintar(tareas = [EN_PROGRESO]) {
  conDedo();
  const convex = makeTestConvexClient([
    stubQuery(api.tasks.list, { items: tareas, restantes: 0 }),
    stubQuery(api.tags.bySystem, []),
    stubQuery(api.sprints.bySystem, []),
  ]);
  renderMobile(
    <ProjectBoard systemId={String(MOCK_SYSTEM_ID)} initialData={tareas} sprintFilter={null} />,
    { convex },
  );
  return convex;
}

/** Abre la hoja de columnas desde las acciones de la fila. */
async function abrirMover() {
  await userEvent.click(screen.getAllByRole("button", { name: "Más acciones" })[0]!);
  await userEvent.click(await screen.findByRole("button", { name: "Mover a otra columna" }));
}

/** Abre la hoja de columnas y elige una. */
async function moverCon(nombreDeColumna: RegExp) {
  await abrirMover();
  await userEvent.click(await screen.findByRole("button", { name: nombreDeColumna }));
}

describe("boardMoveTarget, la guarda que comparten los dos caminos", () => {
  it("mover a otra columna devuelve esa columna", () => {
    expect(boardMoveTarget(EN_PROGRESO, "review")).toBe("review");
  });

  it("mover a la columna donde ya está no devuelve nada que escribir", () => {
    expect(boardMoveTarget(EN_PROGRESO, "in_progress")).toBeNull();
  });

  it("una tarjeta sin columna está en la primera, y moverla ahí tampoco escribe", () => {
    expect(boardMoveTarget(SIN_COLUMNA, "todo")).toBeNull();
    expect(boardMoveTarget(SIN_COLUMNA, "in_progress")).toBe("in_progress");
  });
});

describe("ProjectBoard, el camino con nombre", () => {
  it("mover con la hoja escribe la misma mutación que escribiría el arrastre", async () => {
    const convex = pintar();

    await moverCon(/En review/);

    expect(convex.calls).toEqual([
      {
        kind: "mutation",
        name: "tasks:moveBoard",
        args: { id: EN_PROGRESO.id, boardStatus: "review" },
      },
    ]);
  });

  it("la columna donde la tarjeta ya está no se puede elegir, así que no hay escritura", async () => {
    const convex = pintar();

    await abrirMover();

    expect(await screen.findByRole("button", { name: /En progreso/ })).toBeDisabled();
    expect(convex.calls).toEqual([]);
  });

  it("la hoja dice qué tarjeta se está moviendo", async () => {
    pintar();

    await abrirMover();

    const hoja = await screen.findByRole("dialog");
    expect(within(hoja).getByText("Diagrama ER de la tesis")).toBeVisible();
  });
});
