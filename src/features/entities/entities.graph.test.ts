import { describe, expect, it } from "vitest";
import {
  filterGraph,
  layoutGraph,
  nodeRadius,
  type GraphEdge,
  type GraphNode,
  type UniverseGraph,
} from "./entities.graph";

function node(
  id: string,
  overrides: Partial<GraphNode> = {},
): GraphNode {
  return {
    id,
    name: id,
    type: "character",
    mentionCount: 0,
    workIds: [],
    ...overrides,
  };
}

function edge(id: string, from: string, to: string): GraphEdge {
  return { id, from, to, label: null };
}

describe("filterGraph", () => {
  const graph: UniverseGraph = {
    nodes: [
      node("kael", { type: "character", workIds: ["obra-1"] }),
      node("puente", { type: "location", workIds: ["obra-1", "obra-2"] }),
      node("daga", { type: "object", workIds: ["obra-2"] }),
    ],
    edges: [edge("r1", "kael", "puente"), edge("r2", "puente", "daga")],
    works: [
      { id: "obra-1", name: "Obra 1" },
      { id: "obra-2", name: "Obra 2" },
    ],
  };

  it("sin filtros devuelve el universo entero", () => {
    const { nodes, edges } = filterGraph(graph, {});
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
  });

  it("filtrar por obra deja solo las entidades que aparecen en ella", () => {
    const { nodes } = filterGraph(graph, { workId: "obra-1" });
    expect(nodes.map((n) => n.id)).toEqual(["kael", "puente"]);
  });

  it("descarta las aristas con una punta fuera del filtro", () => {
    // "puente"→"daga" cruza la frontera de la obra: no es dibujable.
    const { edges } = filterGraph(graph, { workId: "obra-1" });
    expect(edges.map((e) => e.id)).toEqual(["r1"]);
  });

  it("filtrar por tipo conserva solo esos tipos", () => {
    const { nodes, edges } = filterGraph(graph, { types: ["location", "object"] });
    expect(nodes.map((n) => n.id)).toEqual(["puente", "daga"]);
    expect(edges.map((e) => e.id)).toEqual(["r2"]);
  });

  it("una lista de tipos vacía no filtra nada", () => {
    expect(filterGraph(graph, { types: [] }).nodes).toHaveLength(3);
  });
});

describe("layoutGraph", () => {
  it("un universo vacío no revienta", () => {
    const layout = layoutGraph([], []);
    expect(layout.nodes).toEqual([]);
  });

  it("una sola entidad queda en el centro", () => {
    const layout = layoutGraph([node("solo")], []);
    expect(layout.nodes[0]!.x).toBe(layout.size / 2);
    expect(layout.nodes[0]!.y).toBe(layout.size / 2);
  });

  it("es determinista: dos corridas iguales dan el mismo mapa", () => {
    const nodes = ["a", "b", "c", "d"].map((id) => node(id));
    const edges = [edge("r1", "a", "b"), edge("r2", "b", "c")];
    const first = layoutGraph(nodes, edges);
    const second = layoutGraph(nodes, edges);
    expect(second.nodes.map((n) => [n.x, n.y])).toEqual(
      first.nodes.map((n) => [n.x, n.y]),
    );
  });

  it("todos los nodos caen dentro del lienzo", () => {
    const nodes = Array.from({ length: 25 }, (_, i) => node(`n${i}`));
    const edges = nodes.slice(1).map((n, i) => edge(`r${i}`, nodes[i]!.id, n.id));
    const layout = layoutGraph(nodes, edges);
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(layout.size);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(layout.size);
    }
  });

  it("una entidad suelta no aplasta al resto contra un punto", () => {
    // Sin acotar la simulación, el nodo sin relaciones se aleja sin freno y, al
    // reencuadrar, todo el universo conectado colapsa en un pixel.
    const nodes = [node("a"), node("b"), node("c"), node("suelta")];
    const layout = layoutGraph(nodes, [edge("r1", "a", "b"), edge("r2", "b", "c")]);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const ab = Math.hypot(
      byId.get("a")!.x - byId.get("b")!.x,
      byId.get("a")!.y - byId.get("b")!.y,
    );
    expect(ab).toBeGreaterThan(layout.size * 0.1);
  });

  it("ningún par de nodos queda encima de otro", () => {
    const nodes = Array.from({ length: 12 }, (_, i) => node(`n${i}`));
    const edges = [edge("r1", "n0", "n1"), edge("r2", "n2", "n3")];
    const layout = layoutGraph(nodes, edges);
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i]!;
        const b = layout.nodes[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(layout.size * 0.04);
      }
    }
  });

  it("cuenta el grado y marca las entidades sueltas con grado 0", () => {
    const nodes = [node("a"), node("b"), node("suelta")];
    const layout = layoutGraph(nodes, [edge("r1", "a", "b")]);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get("a")!.degree).toBe(1);
    expect(byId.get("suelta")!.degree).toBe(0);
  });

  it("los relacionados quedan más cerca que los ajenos", () => {
    // a—b relacionados; c y d sueltos. La atracción tiene que notarse.
    const nodes = [node("a"), node("b"), node("c"), node("d")];
    const layout = layoutGraph(nodes, [edge("r1", "a", "b")]);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const dist = (p: string, q: string) =>
      Math.hypot(byId.get(p)!.x - byId.get(q)!.x, byId.get(p)!.y - byId.get(q)!.y);
    expect(dist("a", "b")).toBeLessThan(dist("c", "d"));
  });

  it("ignora las aristas colgadas y los bucles sobre sí mismo", () => {
    const layout = layoutGraph(
      [node("a"), node("b")],
      [edge("r1", "a", "fantasma"), edge("r2", "a", "a")],
    );
    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges.map((e) => e.id)).toEqual(["r2"]);
    expect(layout.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(
      true,
    );
  });
});

describe("nodeRadius", () => {
  it("crece con las menciones pero tiene techo", () => {
    expect(nodeRadius(0)).toBeLessThan(nodeRadius(10));
    expect(nodeRadius(10)).toBeLessThan(nodeRadius(100));
    expect(nodeRadius(100_000)).toBeLessThanOrEqual(38);
  });

  it("un conteo negativo no produce un radio inválido", () => {
    expect(nodeRadius(-5)).toBeGreaterThan(0);
  });
});
