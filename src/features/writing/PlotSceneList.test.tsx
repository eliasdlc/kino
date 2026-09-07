import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlotSceneList } from "./PlotSceneList";
import type { PlotGrid } from "./writing.plot";

/**
 * El tablero de escenas tiene dos vistas (la rejilla en escritorio y esta lista
 * en el teléfono) y las dos reescriben el manuscrito. Lo que se prueba aquí es
 * que emiten **la misma operación**: si divergen, mover una escena significaría
 * una cosa distinta según la pantalla desde la que se mueva.
 */

const GRID: PlotGrid = {
  folderId: "obra-1" as never,
  folderName: "La casa junto al río",
  arcs: ["Duelo", "Herencia"],
  chapters: [
    {
      chapterId: "cap-1",
      title: "Llegada",
      scenes: [
        { index: 0, arc: "Duelo", preview: "Marta empujó la puerta", wordCount: 320 },
        { index: 1, arc: null, preview: "El mantel seguía puesto", wordCount: 145 },
      ],
    },
    {
      chapterId: "cap-2",
      title: "La carta",
      scenes: [{ index: 0, arc: "Herencia", preview: "Tomás no vino", wordCount: 210 }],
    },
  ],
};

function setup(busy = false) {
  const onApply = vi.fn();
  render(
    <PlotSceneList grid={GRID} systemId="sys-1" busy={busy} onApply={onApply} />,
  );
  return { onApply, user: userEvent.setup() };
}

/** Abre el panel de mover de la primera escena del primer capítulo. */
async function openFirstMove(user: ReturnType<typeof userEvent.setup>) {
  const rows = screen.getAllByRole("button", { name: "Mover" });
  await user.click(rows[0]!);
}

describe("PlotSceneList", () => {
  it("enseña todos los capítulos y sus escenas sin desplazamiento horizontal", () => {
    setup();

    // getBy* ya lanza si no encuentra: la aserción es que los seis existen.
    for (const text of [
      "Llegada",
      "La carta",
      "Marta empujó la puerta",
      "Tomás no vino",
      "2 escenas",
      "1 escena",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("mueve al final del capítulo destino, que es lo que hace la rejilla al soltar", async () => {
    const { onApply, user } = setup();
    await openFirstMove(user);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /La carta/ }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith({
      kind: "move",
      chapterId: "cap-1",
      index: 0,
      toChapterId: "cap-2",
      // El capítulo destino tenía una escena, así que la nueva es la segunda.
      toIndex: 1,
    });
  });

  it("cambia el arco sin mover de capítulo", async () => {
    const { onApply, user } = setup();
    await openFirstMove(user);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Herencia/ }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith({
      kind: "arc",
      chapterId: "cap-1",
      index: 0,
      arc: "Herencia",
    });
  });

  it("no emite nada al elegir donde la escena ya está", async () => {
    const { onApply, user } = setup();
    await openFirstMove(user);

    const dialog = screen.getByRole("dialog");
    // "Llegada" es su capítulo actual y "Duelo" su arco actual: los dos inertes.
    const here = within(dialog).getByRole<HTMLButtonElement>("button", { name: /Llegada/ });
    const sameArc = within(dialog).getByRole<HTMLButtonElement>("button", { name: /Duelo/ });
    expect(here.disabled).toBe(true);
    expect(sameArc.disabled).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
  });
});
