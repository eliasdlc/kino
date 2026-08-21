import { describe, it, expect } from "vitest";
import { reconcileCreated, dropOptimistic } from "./reconcile";

type Item = { id: string; title: string };

const REQ = "11111111-1111-1111-1111-111111111111";
const OTHER_REQ = "22222222-2222-2222-2222-222222222222";

/** Placeholder tal como lo dibuja `onMutate`: su id es el clientRequestId. */
function placeholder(req: string, title = "Capturada sin red"): Item {
  return { id: req, title };
}

describe("reconcileCreated", () => {
  it("sustituye el placeholder optimista por la entidad del servidor", () => {
    const list = [{ id: "a", title: "Antigua" }, placeholder(REQ)];

    const result = reconcileCreated(list, REQ, { id: "server-1", title: "Capturada sin red" });

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["a", "server-1"]);
  });

  it("conserva la posición del placeholder en vez de mandarlo al final", () => {
    const list = [
      { id: "a", title: "Primera" },
      placeholder(REQ),
      { id: "b", title: "Tercera" },
    ];

    const result = reconcileCreated(list, REQ, { id: "server-1", title: "Segunda" });

    expect(result.map((t) => t.id)).toEqual(["a", "server-1", "b"]);
  });

  it("es idempotente: aplicar la misma confirmación dos veces no duplica", () => {
    const created = { id: "server-1", title: "Capturada sin red" };
    const once = reconcileCreated([placeholder(REQ)], REQ, created);
    const twice = reconcileCreated(once, REQ, created);

    expect(twice).toEqual(once);
    expect(twice).toHaveLength(1);
  });

  it("no duplica cuando el servidor devuelve la fila ya existente en un reintento", () => {
    // El INSERT llegó, la respuesta se perdió y la cola reprodujo: gracias al
    // índice único el servidor devuelve la MISMA fila, no una nueva.
    const list = [{ id: "server-1", title: "Capturada sin red" }];

    const result = reconcileCreated(list, REQ, { id: "server-1", title: "Capturada sin red" });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("server-1");
  });

  it("no toca los placeholders de otras capturas offline en vuelo", () => {
    const list = [placeholder(REQ, "Primera"), placeholder(OTHER_REQ, "Segunda")];

    const result = reconcileCreated(list, REQ, { id: "server-1", title: "Primera" });

    expect(result.map((t) => t.id)).toEqual(["server-1", OTHER_REQ]);
  });

  it("tres capturas offline se confirman en tres filas, no en seis", () => {
    const ids = [REQ, OTHER_REQ, "33333333-3333-3333-3333-333333333333"];
    let list: Item[] = ids.map((id, i) => placeholder(id, `Idea ${i + 1}`));

    // La cola se reproduce al reconectar…
    ids.forEach((req, i) => {
      list = reconcileCreated(list, req, { id: `server-${i + 1}`, title: `Idea ${i + 1}` });
    });
    // …y una segunda reproducción de la misma cola no añade nada.
    ids.forEach((req, i) => {
      list = reconcileCreated(list, req, { id: `server-${i + 1}`, title: `Idea ${i + 1}` });
    });

    expect(list).toHaveLength(3);
    expect(list.map((t) => t.id)).toEqual(["server-1", "server-2", "server-3"]);
  });

  it("añade al final cuando no hay placeholder (creación online normal)", () => {
    const list = [{ id: "a", title: "Antigua" }];

    const result = reconcileCreated(list, undefined, { id: "server-1", title: "Nueva" });

    expect(result.map((t) => t.id)).toEqual(["a", "server-1"]);
  });

  it("sin clientRequestId sigue deduplicando por id", () => {
    const list = [{ id: "server-1", title: "Ya estaba" }];

    const result = reconcileCreated(list, undefined, { id: "server-1", title: "Ya estaba" });

    expect(result).toHaveLength(1);
  });

  it("funciona sobre una lista vacía (arranque en frío tras reconectar)", () => {
    const created = { id: "server-1", title: "Capturada sin red" };

    expect(reconcileCreated([], REQ, created)).toEqual([created]);
  });
});

describe("dropOptimistic", () => {
  it("retira sólo el placeholder de esa petición", () => {
    const list = [
      { id: "a", title: "Antigua" },
      placeholder(REQ),
      placeholder(OTHER_REQ),
    ];

    const result = dropOptimistic(list, REQ);

    expect(result.map((t) => t.id)).toEqual(["a", OTHER_REQ]);
  });

  it("no altera la lista si no hay clientRequestId", () => {
    const list = [{ id: "a", title: "Antigua" }];

    expect(dropOptimistic(list, undefined)).toBe(list);
  });
});
