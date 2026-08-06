import { describe, expect, it } from "vitest";
import {
  assignOrders,
  buildTimeline,
  moveWithin,
  readTimelineOrder,
  type TimelineEventInput,
} from "./timeline";

const CHAPTERS = [
  { id: "c1", title: "Capítulo 1" },
  { id: "c2", title: "Capítulo 2" },
  { id: "c3", title: "Capítulo 3" },
];

function event(
  id: string,
  over: Partial<TimelineEventInput> = {},
): TimelineEventInput {
  return {
    id,
    name: id,
    summary: null,
    attributes: null,
    narratedIn: [],
    ...over,
  };
}

describe("readTimelineOrder", () => {
  it("acepta el número", () => {
    expect(readTimelineOrder({ timelineOrder: 4 })).toBe(4);
  });

  it("acepta el string que manda un input HTML", () => {
    expect(readTimelineOrder({ timelineOrder: "4" })).toBe(4);
  });

  it("el orden 0 es una posición válida, no un vacío", () => {
    expect(readTimelineOrder({ timelineOrder: 0 })).toBe(0);
  });

  it("ignora lo que no es un número: el jsonb no garantiza nada", () => {
    expect(readTimelineOrder({ timelineOrder: "hace mucho" })).toBeNull();
    expect(readTimelineOrder({ timelineOrder: "" })).toBeNull();
    expect(readTimelineOrder(null)).toBeNull();
    expect(readTimelineOrder({})).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("separa lo ubicado de lo que falta por ubicar", () => {
    const { placed, unplaced } = buildTimeline(
      [
        event("asedio", { attributes: { timelineOrder: 2 } }),
        event("coronacion", { attributes: { timelineOrder: 1 } }),
        event("sin-ubicar"),
      ],
      CHAPTERS,
    );
    expect(placed.map((e) => e.entityId)).toEqual(["coronacion", "asedio"]);
    expect(unplaced.map((e) => e.entityId)).toEqual(["sin-ubicar"]);
  });

  it("lee la etiqueta in-world y el qué pasó", () => {
    const { placed } = buildTimeline(
      [
        event("asedio", {
          attributes: { timelineOrder: 1, when: "Año 1023, otoño", what: "Cayó el puente" },
        }),
      ],
      CHAPTERS,
    );
    expect(placed[0]!.when).toBe("Año 1023, otoño");
    expect(placed[0]!.what).toBe("Cayó el puente");
  });

  it("descarta las etiquetas en blanco", () => {
    const { placed } = buildTimeline(
      [event("e", { attributes: { timelineOrder: 1, when: "   " } })],
      CHAPTERS,
    );
    expect(placed[0]!.when).toBeNull();
  });

  it("resuelve dónde se narra cada evento, en orden de obra", () => {
    const { placed } = buildTimeline(
      [
        event("asedio", {
          attributes: { timelineOrder: 1 },
          narratedIn: [
            { pageId: "c3", mentionCount: 1 },
            { pageId: "c1", mentionCount: 4 },
          ],
        }),
      ],
      CHAPTERS,
    );
    expect(placed[0]!.narratedIn.map((n) => n.index)).toEqual([1, 3]);
    expect(placed[0]!.firstNarratedIndex).toBe(1);
    expect(placed[0]!.narratedIn[0]!.title).toBe("Capítulo 1");
  });

  it("ignora menciones en capítulos de otra obra", () => {
    const { placed } = buildTimeline(
      [
        event("asedio", {
          attributes: { timelineOrder: 1 },
          narratedIn: [{ pageId: "ajeno", mentionCount: 9 }],
        }),
      ],
      CHAPTERS,
    );
    expect(placed[0]!.narratedIn).toEqual([]);
    expect(placed[0]!.firstNarratedIndex).toBeNull();
  });

  it("desempata por nombre cuando dos eventos comparten posición", () => {
    const { placed } = buildTimeline(
      [
        event("zafiro", { name: "Zafiro", attributes: { timelineOrder: 1 } }),
        event("ambar", { name: "Ámbar", attributes: { timelineOrder: 1 } }),
      ],
      CHAPTERS,
    );
    expect(placed.map((e) => e.name)).toEqual(["Ámbar", "Zafiro"]);
  });
});

describe("desorden narrativo", () => {
  it("una narración lineal no marca nada", () => {
    const { placed } = buildTimeline(
      [
        event("a", { attributes: { timelineOrder: 1 }, narratedIn: [{ pageId: "c1", mentionCount: 1 }] }),
        event("b", { attributes: { timelineOrder: 2 }, narratedIn: [{ pageId: "c2", mentionCount: 1 }] }),
        event("c", { attributes: { timelineOrder: 3 }, narratedIn: [{ pageId: "c3", mentionCount: 1 }] }),
      ],
      CHAPTERS,
    );
    expect(placed.map((e) => e.outOfOrder)).toEqual([false, false, false]);
  });

  it("marca el flashback: lo más antiguo se cuenta al final", () => {
    // "a" pasa primero in-world pero se narra en el capítulo 3, después de "b".
    const { placed } = buildTimeline(
      [
        event("a", { attributes: { timelineOrder: 1 }, narratedIn: [{ pageId: "c3", mentionCount: 1 }] }),
        event("b", { attributes: { timelineOrder: 2 }, narratedIn: [{ pageId: "c1", mentionCount: 1 }] }),
      ],
      CHAPTERS,
    );
    expect(placed[0]!.outOfOrder).toBe(true);
    expect(placed[1]!.outOfOrder).toBe(false);
  });

  it("un evento que no se narra no rompe la comparación", () => {
    const { placed } = buildTimeline(
      [
        event("a", { attributes: { timelineOrder: 1 } }),
        event("b", { attributes: { timelineOrder: 2 }, narratedIn: [{ pageId: "c1", mentionCount: 1 }] }),
      ],
      CHAPTERS,
    );
    expect(placed.map((e) => e.outOfOrder)).toEqual([false, false]);
  });

  it("marca todos los que se adelantan, no solo el primero", () => {
    // El último capítulo cuenta los dos eventos más antiguos: dos flashbacks.
    const { placed } = buildTimeline(
      [
        event("a", { attributes: { timelineOrder: 1 }, narratedIn: [{ pageId: "c3", mentionCount: 1 }] }),
        event("b", { attributes: { timelineOrder: 2 }, narratedIn: [{ pageId: "c3", mentionCount: 1 }] }),
        event("c", { attributes: { timelineOrder: 3 }, narratedIn: [{ pageId: "c1", mentionCount: 1 }] }),
      ],
      CHAPTERS,
    );
    expect(placed.map((e) => e.outOfOrder)).toEqual([true, true, false]);
  });
});

describe("reordenar", () => {
  it("assignOrders reparte posiciones consecutivas desde 1", () => {
    expect([...assignOrders(["b", "a", "c"])]).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });

  it("moveWithin sube y baja un elemento", () => {
    expect(moveWithin(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveWithin(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });

  it("moveWithin no se sale de los bordes ni inventa elementos", () => {
    expect(moveWithin(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveWithin(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveWithin(["a", "b"], "fantasma", 1)).toEqual(["a", "b"]);
  });
});
