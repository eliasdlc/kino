/**
 * Criterio: un bloque de la rejilla de escritorio es un botón que abre la
 * tarea con Intro y con Espacio, y nada se toca dentro de él: el tirador de
 * redimensionar es su hermano y no un control anidado en el botón, y queda
 * fuera del lector de pantalla porque es sólo del ratón.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";
import { makeTask, mid } from "@/app/system-design/mock-data";
import { renderWithProviders } from "@/shared/testing/render";
import { TaskBlock } from "./CalendarBlocks";

function pintar(onOpen = vi.fn()) {
  const task = makeTask({ id: mid("bloque-1"), title: "Leer el capítulo dos", dueDate: new Date(2026, 9, 21, 10, 0).toISOString() });
  renderWithProviders(
    <DndContext>
      <TaskBlock task={task} onOpen={onOpen} onResizeStart={vi.fn()} />
    </DndContext>,
  );
  return { task, onOpen, bloque: screen.getByRole("button", { name: /10:00, Leer el capítulo dos/ }) };
}

describe("TaskBlock", () => {
  it("abre con Espacio como cualquier botón", async () => {
    const { bloque, onOpen, task } = pintar();
    bloque.focus();
    await userEvent.keyboard(" ");
    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("el tirador de redimensionar no vive dentro del botón", () => {
    const { bloque } = pintar();
    const tirador = bloque.parentElement!.querySelector(".cursor-row-resize");
    expect(tirador).toBeInTheDocument();
    expect(bloque).not.toContainElement(tirador as HTMLElement);
    expect(tirador).toHaveAttribute("aria-hidden");
  });
});
