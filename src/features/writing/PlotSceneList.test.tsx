/**
 * El tablero de escenas tiene dos vistas (la rejilla en escritorio y esta lista
 * en el teléfono) y las dos reescriben el manuscrito. Lo que se prueba aquí es
 * que emiten **la misma operación**: si divergen, mover una escena significaría
 * una cosa distinta según la pantalla desde la que se mueva. Y que cada Mover
 * dice qué escena mueve, porque reescribe el texto: la hoja nombra la escena,
 * el aviso dice qué pasó y Deshacer aplica la operación inversa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { PlotSceneList } from "./PlotSceneList";
import { arcStats, describirArco } from "./PlotGridView";
import type { PlotGrid } from "./writing.plot";

vi.mock("sonner", () => ({ toast: vi.fn() }));

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

type Apply = React.ComponentProps<typeof PlotSceneList>["onApply"];

function setup(busy = false, grid: PlotGrid = GRID) {
  const onApply = vi.fn<Apply>();
  renderWithProviders(
    <PlotSceneList grid={grid} systemId="sys-1" busy={busy} onApply={onApply} />,
  );
  return { onApply, user: userEvent.setup() };
}

/** Lo que el aviso ofrece como Deshacer, tras confirmar el servidor la operación. */
function deshacerDelAviso(onApply: ReturnType<typeof setup>["onApply"]) {
  void onApply.mock.calls[0]![1]?.onSuccess?.(GRID as never, onApply.mock.calls[0]![0]!);
  const [, opciones] = vi.mocked(toast).mock.calls[0]!;
  return (opciones as { action: { label: string; onClick: () => void } }).action;
}

beforeEach(() => vi.mocked(toast).mockClear());

/** Abre el panel de mover de la primera escena del primer capítulo. */
async function openFirstMove(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Mover la escena 1 de Llegada" }));
}

describe("PlotSceneList", () => {
  it("enseña todos los capítulos y sus escenas sin desplazamiento horizontal", () => {
    setup();

    for (const text of [
      "Llegada",
      "La carta",
      "Marta empujó la puerta",
      "Tomás no vino",
      "2 escenas",
      "1 escena",
    ]) {
      expect(screen.getByText(text)).toBeVisible();
    }
  });

  it("mueve al final del capítulo destino, que es lo que hace la rejilla al soltar", async () => {
    const { onApply, user } = setup();
    await openFirstMove(user);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /La carta/ }));

    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply.mock.calls[0]![0]).toEqual({
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

    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply.mock.calls[0]![0]).toEqual({
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
    // No son botones: no hay nada que tocar donde la escena ya está.
    expect(within(dialog).queryByRole("button", { name: /Llegada/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Duelo/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByText("Llegada"));
    expect(within(dialog).getByText("aquí está")).toBeVisible();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("cada Mover nombra su escena y su capítulo, y no hay dos iguales", () => {
    setup();
    const nombres = screen.getAllByRole("button", { name: /^Mover la escena/ }).map((b) => b.getAttribute("aria-label"));
    expect(nombres).toEqual([
      "Mover la escena 1 de Llegada",
      "Mover la escena 2 de Llegada",
      "Mover la escena 1 de La carta",
    ]);
  });
});

describe("PlotSceneList, lo que se ve al mover", () => {
  it("la hoja nombra la escena: su número, su capítulo y su arranque", async () => {
    const { user } = setup();
    await openFirstMove(user);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Mover la escena 1 de Llegada" })).toBeVisible();
    expect(within(dialog).getByText("Marta empujó la puerta")).toBeVisible();
  });

  it("al mover, el aviso dice adónde fue y Deshacer la devuelve a su sitio", async () => {
    const { onApply, user } = setup();
    await openFirstMove(user);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /La carta/ }));

    const accion = deshacerDelAviso(onApply);
    expect(vi.mocked(toast).mock.calls[0]![0]).toBe("Escena movida a La carta");
    expect(accion.label).toBe("Deshacer");
    accion.onClick();
    expect(onApply.mock.calls[1]![0]).toEqual({
      kind: "move",
      chapterId: "cap-2",
      index: 1,
      toChapterId: "cap-1",
      toIndex: 0,
    });
  });

  it("al cambiar de arco, Deshacer vuelve al arco que tenía", async () => {
    const { onApply, user } = setup();
    await openFirstMove(user);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Herencia/ }));

    deshacerDelAviso(onApply).onClick();
    expect(onApply.mock.calls[1]![0]).toEqual({ kind: "arc", chapterId: "cap-1", index: 0, arc: "Duelo" });
  });

  it("mientras reescribe lo dice también en el teléfono", () => {
    setup(true);
    expect(screen.getByRole("status")).toHaveTextContent("Reescribiendo el capítulo");
  });

  it("sin arcos no ofrece una lista inútil, sino el primer arco, y las filas no repiten «sin arco»", async () => {
    const sinArcos: PlotGrid = {
      ...GRID,
      arcs: [],
      chapters: GRID.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => ({ ...s, arc: null })) })),
    };
    const { onApply, user } = setup(false, sinArcos);
    expect(screen.queryByText(/sin arco/)).not.toBeInTheDocument();
    await openFirstMove(user);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Sin arco")).not.toBeInTheDocument();
    await user.type(within(dialog).getByRole("textbox", { name: "Arco nuevo" }), "Duelo");
    await user.click(within(dialog).getByRole("button", { name: "Poner" }));
    expect(onApply.mock.calls[0]![0]).toEqual({ kind: "arc", chapterId: "cap-1", index: 0, arc: "Duelo" });
  });
});

describe("estado de cada arco en la rejilla", () => {
  it("suma escenas y palabras por arco, y las escenas sin arco van aparte", () => {
    const porArco = arcStats(GRID);
    expect(describirArco(porArco.get("Duelo"))).toBe("1 escena, 320 palabras");
    expect(describirArco(porArco.get("Herencia"))).toBe("1 escena, 210 palabras");
    expect(describirArco(porArco.get("__sin_arco__"))).toBe("1 escena, 145 palabras");
  });

  it("un arco sin escenas lo dice en vez de enseñar un cero", () => {
    expect(describirArco(undefined)).toBe("sin escenas");
  });
});

