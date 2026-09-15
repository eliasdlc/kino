/**
 * Criterio: en la capa flotante la nota se arrastra desde toda la tarjeta menos
 * sus dos botones, y todo lo demás se pulsa. Hasta el 14 sep 2026 no se pulsaba
 * nada: el envoltorio capturaba el puntero en el `pointerdown` y se quedaba con
 * el `click`, y los eventos de los menús (que React sube por su árbol aunque
 * estén montados en `<body>`) arrancaban un arrastre en vez de activar su item.
 */
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeStickyNote, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders } from "@/shared/testing/render";
import { FloatingNotesLayer } from "./FloatingNotesLayer";
import { clampToGutter, gutterLayout, gutterSlots, preferredGutter, type NotebookMetrics } from "./sticky-position";
import type { StickyNoteItem } from "./sticky-notes.types";

const PAGINA = mid("pagina-1");
const NOTA = makeStickyNote({
  id: mid("nota-flotante"),
  title: "Idea de tesis",
  content: "medir la energia",
  positionSide: "over",
  positionX: 0.9,
  positionY: 0.3,
});

/**
 * El lienzo que la capa necesita. La medida llega por props porque en la app la
 * toma quien monta la capa, para que la rejilla y la capa no decidan por
 * separado quién dibuja cada nota. Aquí se fija a un cuaderno de 1440 con su
 * columna centrada, que es donde hay margen para las dos notas.
 */
const CUADERNO: NotebookMetrics = {
  columnLeft: 176,
  columnWidth: 816,
  textLeft: 200,
  textWidth: 768,
  containerW: 1168,
  containerH: 2000,
};

function Lienzo({ notes, metrics = CUADERNO }: { notes: StickyNoteItem[]; metrics?: NotebookMetrics }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} className="relative">
      <FloatingNotesLayer notes={notes} context={{ pageId: PAGINA }} containerRef={containerRef} metrics={metrics} />
    </div>
  );
}

function pintar(notes: StickyNoteItem[] = [NOTA]) {
  const convex = makeTestConvexClient();
  const { container } = renderWithProviders(<Lienzo notes={notes} />, { convex });
  return { convex, container };
}

const mutaciones = (convex: ReturnType<typeof makeTestConvexClient>) =>
  convex.calls.filter((c) => c.kind === "mutation");

/** Los envoltorios que llevan la posición y el z de cada nota. */
const envoltorios = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(".absolute.w-44")];

/** Mueve el puntero apretado. Pasado el umbral de 4 px es arrastre; antes, click. */
async function arrastrar(desde: Element, dx: number, dy = 40) {
  await userEvent.pointer([
    { target: desde, coords: { clientX: 200, clientY: 200 }, keys: "[MouseLeft>]" },
    { coords: { clientX: 200 + dx, clientY: 200 + dy } },
    { keys: "[/MouseLeft]" },
  ]);
}

describe("los controles de una nota flotante", () => {
  it("la X la borra", async () => {
    const { convex } = pintar();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar nota" }));

    expect(mutaciones(convex)).toEqual([
      { kind: "mutation", name: "stickyNotes:remove", args: { id: NOTA.id } },
    ]);
  });

  it("pulsar el cuerpo abre el editor", async () => {
    pintar();

    await userEvent.click(screen.getByText("Idea de tesis"));

    expect(await screen.findByPlaceholderText("Título...")).toBeVisible();
  });

  it("el menú contextual marca eureka, aunque se monte en un portal", async () => {
    const { convex } = pintar();

    fireEvent.contextMenu(screen.getByText("Idea de tesis"));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Marcar eureka/ }));

    expect(mutaciones(convex)).toEqual([
      {
        kind: "mutation",
        name: "stickyNotes:update",
        args: { id: NOTA.id, isEureka: true },
      },
    ]);
  });

  it("el menú de posición manda la nota al margen derecho", async () => {
    const { convex } = pintar();

    await userEvent.click(screen.getByRole("button", { name: "Opciones de posición" }));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Margen derecho/ }));

    expect(mutaciones(convex)).toEqual([
      {
        kind: "mutation",
        name: "stickyNotes:update",
        args: { id: NOTA.id, positionSide: "right", positionY: NOTA.positionY, positionX: 1.03 },
      },
    ]);
  });
});

describe("el arrastre de una nota flotante", () => {
  it("arrastrar desde el cuerpo guarda la posición nueva", async () => {
    const { convex } = pintar();

    await arrastrar(screen.getByText("Idea de tesis"), 120);

    const escritas = mutaciones(convex);
    expect(escritas).toHaveLength(1);
    expect(escritas[0]!.name).toBe("stickyNotes:update");
    expect(escritas[0]!.args).toMatchObject({ id: NOTA.id, positionSide: "over" });
  });

  it("empezar sobre un botón pulsa, no arrastra", async () => {
    const { convex } = pintar();

    await arrastrar(screen.getByRole("button", { name: "Eliminar nota" }), 120);

    // La nota se borra y nadie guarda una posición: el botón no es un asa.
    expect(mutaciones(convex).map((c) => c.name)).toEqual(["stickyNotes:remove"]);
  });

  it("un click corto no deja de ser un click", async () => {
    pintar();

    await arrastrar(screen.getByText("Idea de tesis"), 2, 1);

    expect(await screen.findByPlaceholderText("Título...")).toBeVisible();
  });
});

describe("el z de las notas", () => {
  it("nunca llega a --z-overlay, por muchas veces que las toques", async () => {
    const notas = Array.from({ length: 12 }, (_, i) =>
      makeStickyNote({ id: mid(`nota-${i}`), title: `Nota ${i}`, content: null, positionSide: "over" })
    );
    const { container } = pintar(notas);

    for (const nota of notas) {
      await userEvent.click(screen.getByText(nota.title!));
      await userEvent.keyboard("{Escape}");
    }

    const zs = envoltorios(container).map((el) => Number(el.style.zIndex));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...zs)).toBeLessThan(20);
  });
});

describe("donde se dibuja una nota", () => {
  /** Un cuaderno con la columna de 816 y el hueco repartido segun el acomodo. */
  const cuaderno = (containerW: number, columnLeft: number): NotebookMetrics => ({
    columnLeft,
    columnWidth: 816,
    // La columna lleva 24 px de padding a cada lado, que no son texto.
    textLeft: columnLeft + 24,
    textWidth: 768,
    containerW,
    containerH: 2000,
  });
  const centrada = (containerW: number) => cuaderno(containerW, (containerW - 816) / 2);

  it("con hueco de sobra la columna se queda centrada", () => {
    expect(gutterLayout(1600, 816, "right")).toBe("center");
  });

  it("con hueco para una sola nota la columna se corre al lado contrario", () => {
    // 1300 px de ventana con el panel abierto: 1028 de contenedor, 212 de hueco.
    // Centrada son 106 por lado y no cabe nada; corrida, los 212 son de un lado.
    expect(gutterLayout(1028, 816, "right")).toBe("right");
    expect(gutterLayout(1028, 816, "left")).toBe("left");
  });

  it("sin hueco ni para una, la nota no flota", () => {
    expect(gutterLayout(859, 816, "right")).toBe("none");
  });

  it("el lado lo eligen las notas, y a la par gana el derecho", () => {
    expect(preferredGutter([-0.23, -0.23, 1.03])).toBe("left");
    expect(preferredGutter([1.03])).toBe("right");
    expect(preferredGutter([-0.23, 1.03])).toBe("right");
  });

  it("con la columna corrida, el margen que queda si admite la tarjeta", () => {
    const corrida = cuaderno(1028, 0);

    const slots = gutterSlots(corrida);

    expect(slots.left).toBeNull();
    expect(slots.right).not.toBeNull();
    // Y deja aire contra el texto, no pegada a el: la tarjeta va inclinada.
    expect(slots.right!.from).toBeGreaterThan(corrida.textLeft + corrida.textWidth);
  });

  it("una X que caeria sobre el texto se lleva al margen", () => {
    const m = cuaderno(1028, 0);

    const puesta = clampToGutter(m.textLeft + m.textWidth / 2, m);

    expect(puesta).toBeGreaterThanOrEqual(m.textLeft + m.textWidth);
  });

  it("centrada y estrecha no hay margen a ningun lado", () => {
    expect(gutterSlots(centrada(1028))).toEqual({ left: null, right: null });
  });
});

describe("una nota larga", () => {
  it("se acota y avisa de que hay mas", async () => {
    const larga = makeStickyNote({
      id: mid("nota-larga"),
      title: "Nota larga",
      content: "x".repeat(500),
      positionSide: "over",
    });
    pintar([larga]);

    // El cuerpo va en una caja con tope; el texto entero sigue en el DOM para
    // que quien lea con lector de pantalla no pierda nada.
    const cuerpo = screen.getByText("x".repeat(500)).parentElement!;
    expect(cuerpo.style.maxHeight).toBe("168px");
    expect(cuerpo.className).toContain("overflow-hidden");
  });
});
