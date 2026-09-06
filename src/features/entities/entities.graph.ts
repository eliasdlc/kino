/**
 * Layout del grafo del universo (KIN-136). El grafo es **solo render**: las
 * relaciones ya viven en `entity_relations` desde W2, así que aquí no se captura
 * nada: solo se decide dónde cae cada nodo.
 *
 * El layout es una Fruchterman-Reingold recortada, escrita a mano a propósito:
 * meter una librería de grafos costaría entre 40 y 100 kB de bundle para dibujar
 * círculos y líneas, y la restricción de bundle del proyecto no lo justifica.
 *
 * Es **determinista**: las posiciones iniciales se reparten en un círculo por
 * índice, no al azar. Abrir el mismo universo dos veces dibuja el mismo mapa, que
 * es lo que hace que se pueda reconocer de un vistazo.
 */

import type { EntityType } from "./entities.attributes";

export interface GraphNode {
  id: string;
  name: string;
  type: EntityType;
  /** Menciones totales en el texto: dicta el tamaño del nodo. */
  mentionCount: number;
  /** Obras (folders) donde la entidad aparece, para el filtro por obra. */
  workIds: string[];
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string | null;
}

export interface UniverseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Obras del sistema, para poblar el filtro. */
  works: Array<{ id: string; name: string }>;
}

export interface LaidOutNode extends GraphNode {
  x: number;
  y: number;
  /** Aristas que tocan el nodo: un 0 es una entidad suelta del universo. */
  degree: number;
}

export interface GraphLayout {
  nodes: LaidOutNode[];
  edges: GraphEdge[];
  /** Lado del lienzo cuadrado en unidades de viewBox. */
  size: number;
}

const SIZE = 1000;
const ITERATIONS = 320;
/** Distancia mínima que se usa como divisor: evita el infinito al solaparse. */
const EPSILON = 0.01;

/**
 * Filtra el grafo a las entidades que aparecen en una obra, arrastrando solo las
 * aristas cuyos dos extremos sobreviven. Filtrar por obra es leer el universo
 * *desde* una historia: las entidades compartidas siguen siendo las mismas.
 */
export function filterGraph(
  graph: UniverseGraph,
  filters: { workId?: string | null; types?: EntityType[] | null },
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const types = filters.types && filters.types.length > 0 ? new Set(filters.types) : null;
  const workId = filters.workId ?? null;

  const nodes = graph.nodes.filter((n) => {
    if (types && !types.has(n.type)) return false;
    if (workId && !n.workIds.includes(workId)) return false;
    return true;
  });

  const alive = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => alive.has(e.from) && alive.has(e.to));
  return { nodes, edges };
}

/**
 * Coloca los nodos. Repulsión entre todos los pares, atracción por arista y un
 * enfriamiento lineal que congela el dibujo en las últimas iteraciones.
 */
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]): GraphLayout {
  const n = nodes.length;
  if (n === 0) return { nodes: [], edges: [], size: SIZE };

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }

  if (n === 1) {
    const only = nodes[0]!;
    return {
      nodes: [{ ...only, x: SIZE / 2, y: SIZE / 2, degree: degree.get(only.id) ?? 0 }],
      edges: [],
      size: SIZE,
    };
  }

  // Semilla determinista: un círculo. Empezar repartido (y no amontonado) es lo
  // que hace que la simulación converja en pocas iteraciones.
  const radius = SIZE * 0.35;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const index = new Map<string, number>();
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    xs[i] = SIZE / 2 + radius * Math.cos(angle);
    ys[i] = SIZE / 2 + radius * Math.sin(angle);
    index.set(node.id, i);
  });

  // k = distancia de equilibrio entre dos nodos para el área disponible.
  const k = Math.sqrt((SIZE * SIZE) / n);
  const dxs = new Float64Array(n);
  const dys = new Float64Array(n);
  let temperature = SIZE / 10;
  const cooling = temperature / (ITERATIONS + 1);

  const pairs: Array<[number, number]> = [];
  for (const e of edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    pairs.push([a, b]);
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    dxs.fill(0);
    dys.fill(0);

    // Repulsión: todos contra todos, k²/d.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[i]! - xs[j]!;
        let dy = ys[i]! - ys[j]!;
        let dist = Math.hypot(dx, dy);
        if (dist < EPSILON) {
          // Solapados exactos: se separan por una diagonal fija (determinista)
          // en vez de por un vector aleatorio.
          dx = EPSILON;
          dy = EPSILON;
          dist = Math.hypot(dx, dy);
        }
        const force = (k * k) / dist;
        const ux = (dx / dist) * force;
        const uy = (dy / dist) * force;
        dxs[i]! += ux;
        dys[i]! += uy;
        dxs[j]! -= ux;
        dys[j]! -= uy;
      }
    }

    // Atracción: solo entre relacionados, d²/k.
    for (const [a, b] of pairs) {
      const dx = xs[a]! - xs[b]!;
      const dy = ys[a]! - ys[b]!;
      const dist = Math.max(EPSILON, Math.hypot(dx, dy));
      const force = (dist * dist) / k;
      const ux = (dx / dist) * force;
      const uy = (dy / dist) * force;
      dxs[a]! -= ux;
      dys[a]! -= uy;
      dxs[b]! += ux;
      dys[b]! += uy;
    }

    for (let i = 0; i < n; i++) {
      const disp = Math.max(EPSILON, Math.hypot(dxs[i]!, dys[i]!));
      const step = Math.min(disp, temperature);
      // Acotar al marco es parte del algoritmo, no un remate. Una entidad sin
      // ninguna relación solo recibe repulsión: sin techo se aleja iteración a
      // iteración hasta el infinito y, al reescalar, aplasta contra un punto todo
      // el resto del universo. Ese es justo el caso que hay que poder mirar.
      xs[i] = clamp(xs[i]! + (dxs[i]! / disp) * step);
      ys[i] = clamp(ys[i]! + (dys[i]! / disp) * step);
    }

    temperature -= cooling;
  }

  return {
    nodes: normalize(nodes, xs, ys, degree),
    edges: pairs.length === edges.length ? edges : edges.filter((e) => index.has(e.from) && index.has(e.to)),
    size: SIZE,
  };
}

/** Mantiene una coordenada dentro del lienzo de la simulación. */
function clamp(value: number): number {
  return Math.min(SIZE, Math.max(0, value));
}

/**
 * Reencuadra el resultado con un margen: la simulación ya cabe en el lienzo,
 * pero rara vez lo llena: sin esto el grafo se dibuja pequeño y descentrado.
 */
function normalize(
  nodes: GraphNode[],
  xs: Float64Array,
  ys: Float64Array,
  degree: Map<string, number>,
): LaidOutNode[] {
  const margin = SIZE * 0.08;
  const usable = SIZE - margin * 2;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < nodes.length; i++) {
    minX = Math.min(minX, xs[i]!);
    maxX = Math.max(maxX, xs[i]!);
    minY = Math.min(minY, ys[i]!);
    maxY = Math.max(maxY, ys[i]!);
  }

  const spanX = Math.max(EPSILON, maxX - minX);
  const spanY = Math.max(EPSILON, maxY - minY);
  // Un solo factor para los dos ejes: escalar distinto en x y en y deformaría
  // los ángulos y el mapa dejaría de leerse como un mapa.
  const scale = Math.min(usable / spanX, usable / spanY);
  const offsetX = margin + (usable - spanX * scale) / 2;
  const offsetY = margin + (usable - spanY * scale) / 2;

  return nodes.map((node, i) => ({
    ...node,
    x: offsetX + (xs[i]! - minX) * scale,
    y: offsetY + (ys[i]! - minY) * scale,
    degree: degree.get(node.id) ?? 0,
  }));
}

/** Radio del nodo según sus menciones: lo que más se nombra pesa más. */
export function nodeRadius(mentionCount: number): number {
  const base = 14;
  const grown = base + Math.sqrt(Math.max(0, mentionCount)) * 4;
  return Math.min(38, grown);
}
