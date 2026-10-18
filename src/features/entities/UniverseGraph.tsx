"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUniverseGraph } from "./entities.hooks";
import { EntityFicheSheet } from "./EntityFicheSheet";
import { ENTITY_TYPES, type EntityType } from "./entities.attributes";
import { ENTITY_TYPE_ICON, ENTITY_TYPE_LABEL, ENTITY_TYPE_LABEL_PLURAL } from "./entities.ui";
import { GraphSkeleton } from "./UniverseGraphLazy";
import {
  filterGraph,
  layoutGraph,
  nodeHitRadius,
  nodeRadius,
  type GraphEdge,
  type GraphLayout,
  type LaidOutNode,
} from "./entities.graph";

/**
 * Mapa visual del universo (KIN-136). Es **solo render**: nada que capturar, nada
 * que migrar: las relaciones ya están en `entity_relations` desde W2.
 *
 * Monocromo a propósito, como el resto del sistema de diseño: el tipo de entidad
 * se lee por su icono, no por un color; el peso, por el tamaño del nodo. Una
 * entidad sin ninguna relación se dibuja con el borde punteado, que es
 * justamente lo que se viene a ver de un vistazo.
 */

const TODAS = "__all__";

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function UniverseGraph({ systemId }: { systemId: string }) {
  const { data, isLoading } = useUniverseGraph(systemId);
  const [workId, setWorkId] = useState<string>(TODAS);
  const [hidden, setHidden] = useState<Set<EntityType>>(new Set());
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  const types = useMemo(
    () => ENTITY_TYPES.filter((t) => !hidden.has(t)),
    [hidden],
  );

  const layout = useMemo(() => {
    if (!data) return null;
    const { nodes, edges } = filterGraph(data, {
      workId: workId === TODAS ? null : workId,
      types,
    });
    return layoutGraph(nodes, edges);
  }, [data, workId, types]);

  // Tipos presentes en el universo: no tiene sentido ofrecer filtrar por algo
  // que nadie ha creado todavía.
  const presentTypes = useMemo(() => {
    const set = new Set<EntityType>();
    for (const n of data?.nodes ?? []) set.add(n.type);
    return ENTITY_TYPES.filter((t) => set.has(t));
  }, [data]);

  function toggleType(type: EntityType) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (isLoading) return <GraphSkeleton />;

  const total = data?.nodes.length ?? 0;

  if (total === 0) {
    return (
      <EmptyState
        title="No hay universo que dibujar"
        description="El mapa aparece cuando existen entidades. Menciónalas con @ mientras escribes o créalas en la biblioteca."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {presentTypes.map((type) => {
            const Icon = ENTITY_TYPE_ICON[type];
            const on = !hidden.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={on}
                className={cn(
                  // Ver u ocultar un tipo es un estado: en tinta, no en ámbar.
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring pointer-coarse:min-h-[2.85rem] pointer-coarse:px-3.5 pointer-coarse:text-sm",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {ENTITY_TYPE_LABEL_PLURAL[type]}
              </button>
            );
          })}
        </div>

        {(data?.works.length ?? 0) > 0 && (
          <Select value={workId} onValueChange={setWorkId}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar por obra">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todo el universo</SelectItem>
              {data!.works.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {layout && layout.nodes.length === 0 ? (
        <EmptyState
          title="Ninguna entidad cumple el filtro"
          description="Vuelve a mostrar algún tipo o elige otra obra."
        />
      ) : (
        layout && <GraphCanvas layout={layout} onOpen={setOpenEntityId} />
      )}

      <EntityFicheSheet
        entityId={openEntityId}
        systemId={systemId}
        open={openEntityId !== null}
        onOpenChange={(o) => !o && setOpenEntityId(null)}
      />
    </div>
  );
}

const ZOOM_STEP = 1.25;
const MIN_SPAN = 120;
/** Lo que un dedo se mueve sin que cuente como arrastre: un toque no es un pan. */
const DRAG_THRESHOLD_PX = 4;
/**
 * El lado corto que se supone antes de medir: el del teléfono más estrecho. Si
 * se equivoca, se equivoca hacia un blanco más grande, nunca hacia uno corto.
 */
const UNMEASURED_SHORT_SIDE_PX = 320;

export interface GraphCanvasProps {
  layout: GraphLayout;
  onOpen: (entityId: string) => void;
}

interface Gesture {
  /** Punteros apoyados, con su última posición en píxeles de pantalla. */
  pointers: Map<number, { x: number; y: number }>;
  /** Dónde empezó el gesto de un dedo, para separar un toque de un arrastre. */
  origin: { x: number; y: number } | null;
  /** Distancia entre los dos dedos en el último movimiento del pellizco. */
  pinchDistance: number | null;
  /** El gesto ya movió la vista: el clic que lo cierra no abre ninguna entidad. */
  moved: boolean;
}

/** El lienzo, separado del contenedor con filtros para poder sembrarlo en `/system-design`. */
export function GraphCanvas({ layout, onOpen }: GraphCanvasProps) {
  const initial: ViewBox = { x: 0, y: 0, w: layout.size, h: layout.size };
  const [view, setView] = useState<ViewBox>(initial);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [shortSidePx, setShortSidePx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRef = useRef<ViewBox>(initial);
  const frame = useRef<number | null>(null);
  const gesture = useRef<Gesture>({ pointers: new Map(), origin: null, pinchDistance: null, moved: false });
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  // El blanco táctil se calcula en píxeles de pantalla, así que hace falta
  // saber cuánto mide el lienzo, y volver a medirlo si el ancho cambia.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      const side = Math.min(rect.width, rect.height);
      if (side > 0) setShortSidePx(side);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /**
   * Fija la vista. Un arrastre o un pellizco llegan a decenas de eventos por
   * fotograma; se juntan en uno con `requestAnimationFrame`, y como el dibujo
   * del grafo está memoizado, lo único que React vuelve a pintar es el viewBox.
   */
  const commit = useCallback((next: ViewBox, now = false) => {
    viewRef.current = next;
    if (now) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      setView(next);
      return;
    }
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setView(viewRef.current);
    });
  }, []);

  /** La vista con el zoom aplicado alrededor de un punto del viewBox. */
  function zoomed(v: ViewBox, factor: number, cx: number, cy: number): ViewBox {
    const w = Math.min(layout.size * 2, Math.max(MIN_SPAN, v.w / factor));
    const k = w / v.w;
    return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w, h: w };
  }

  function zoomCenter(factor: number) {
    const v = viewRef.current;
    commit(zoomed(v, factor, v.x + v.w / 2, v.y + v.h / 2), true);
  }

  /**
   * Unidades del viewBox por píxel, y el punto del viewBox bajo una posición de
   * pantalla. El viewBox es cuadrado y se centra en el lado largo, así que la
   * escala la pone el lado corto.
   */
  function toView(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const side = Math.min(rect.width, rect.height);
    const scale = v.w / side;
    return {
      scale,
      x: v.x + (clientX - rect.left - (rect.width - side) / 2) * scale,
      y: v.y + (clientY - rect.top - (rect.height - side) / 2) * scale,
    };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (g.pointers.size === 0) g.moved = false;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    g.origin = { x: e.clientX, y: e.clientY };
    g.pinchDistance = null;
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    const last = g.pointers.get(e.pointerId);
    if (!last) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.pointers.size >= 2) {
      // Pellizco: la distancia entre los dos dedos dicta el zoom, centrado en
      // el punto medio, que es donde la persona está mirando.
      const [a, b] = [...g.pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (g.pinchDistance !== null && g.pinchDistance > 0 && distance > 0) {
        const mid = toView((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
        if (mid) commit(zoomed(viewRef.current, distance / g.pinchDistance, mid.x, mid.y));
      }
      if (g.pinchDistance === null) e.currentTarget.setPointerCapture?.(e.pointerId);
      g.pinchDistance = distance;
      g.moved = true;
      return;
    }

    // Un dedo o el ratón: hasta pasar el umbral es un toque, y el clic abre el
    // nodo. La captura del puntero se pide sólo al empezar a arrastrar, porque
    // con ella el clic caería en el lienzo y no en el nodo.
    if (!g.moved) {
      const from = g.origin ?? last;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_THRESHOLD_PX) return;
      g.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const here = toView(e.clientX, e.clientY);
    if (!here) return;
    // El desplazamiento está en píxeles y el viewBox en unidades: la escala
    // entre ambos hace que el arrastre no sea ni lento ni disparado con zoom.
    const v = viewRef.current;
    commit({
      ...v,
      x: v.x - (e.clientX - last.x) * here.scale,
      y: v.y - (e.clientY - last.y) * here.scale,
    });
  }

  function endPointer(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    g.pointers.delete(e.pointerId);
    g.pinchDistance = null;
    const rest = [...g.pointers.values()][0];
    // Al levantar un dedo del pellizco, el que queda sigue arrastrando desde
    // donde está, sin salto.
    g.origin = rest ?? null;
  }

  const open = useCallback((id: string) => {
    // El clic que cierra un arrastre o un pellizco no abre la entidad de debajo.
    if (gesture.current.moved) return;
    onOpenRef.current(id);
  }, []);

  const openFromKeyboard = useCallback((id: string) => onOpenRef.current(id), []);

  const leave = useCallback(
    (id: string) => setHoverId((cur) => (cur === id ? null : cur)),
    [],
  );

  // El blanco depende del zoom, no del pan: el dibujo sólo se repinta al
  // acercar o alejar.
  const side = shortSidePx ?? UNMEASURED_SHORT_SIDE_PX;
  const hitSpan = Math.round(view.w);

  return (
    <div className="overflow-hidden rounded-lg border bg-muted/10">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="block h-[28rem] w-full touch-none select-none md:h-[34rem]"
        role="group"
        aria-label="Grafo del universo"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <GraphScene
          layout={layout}
          hoverId={hoverId}
          hitSpan={hitSpan}
          shortSidePx={side}
          onOpen={open}
          onOpenFromKeyboard={openFromKeyboard}
          onHover={setHoverId}
          onLeave={leave}
        />
      </svg>

      {/* Los controles van bajo el lienzo y no encima: en el teléfono una
          columna de botones en la esquina tapaba justo los nodos de ahí. */}
      <div className="flex justify-end gap-1 border-t px-2 py-1.5">
        <Button variant="outline" size="icon-sm" onClick={() => zoomCenter(ZOOM_STEP)} aria-label="Acercar">
          <Plus className="size-4" />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => zoomCenter(1 / ZOOM_STEP)} aria-label="Alejar">
          <Minus className="size-4" />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => commit(initial, true)} aria-label="Ajustar a la vista">
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface GraphSceneProps {
  layout: GraphLayout;
  hoverId: string | null;
  /** Span del viewBox redondeado: con él se calcula el blanco táctil. */
  hitSpan: number;
  shortSidePx: number;
  onOpen: (id: string) => void;
  onOpenFromKeyboard: (id: string) => void;
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
}

/**
 * Aristas y nodos. Memoizado: un arrastre cambia el viewBox del `<svg>` y nada
 * más, así que React no vuelve a recorrer cada arista y cada nodo por evento.
 */
const GraphScene = memo(function GraphScene({
  layout,
  hoverId,
  hitSpan,
  shortSidePx,
  onOpen,
  onOpenFromKeyboard,
  onHover,
  onLeave,
}: GraphSceneProps) {
  const byId = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout.nodes],
  );

  // Vecinos del nodo bajo el cursor o con el foco: resaltar su barrio es la
  // lectura que hace útil un grafo denso ("¿con quién converge este personaje?").
  const neighbours = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const e of layout.edges) {
      if (e.from === hoverId) set.add(e.to);
      if (e.to === hoverId) set.add(e.from);
    }
    return set;
  }, [hoverId, layout.edges]);

  return (
    <>
      <g className="stroke-border" strokeWidth={1.5}>
        {layout.edges.map((edge) => (
          <GraphEdgeLine key={edge.id} edge={edge} byId={byId} neighbours={neighbours} />
        ))}
      </g>

      {layout.nodes.map((node) => (
        <GraphNodeButton
          key={node.id}
          node={node}
          dim={neighbours !== null && !neighbours.has(node.id)}
          active={hoverId === node.id}
          hitRadius={nodeHitRadius(nodeRadius(node.mentionCount), hitSpan, shortSidePx)}
          onOpen={onOpen}
          onOpenFromKeyboard={onOpenFromKeyboard}
          onHover={onHover}
          onLeave={onLeave}
        />
      ))}
    </>
  );
});

function GraphEdgeLine({
  edge,
  byId,
  neighbours,
}: {
  edge: GraphEdge;
  byId: Map<string, LaidOutNode>;
  neighbours: Set<string> | null;
}) {
  const a = byId.get(edge.from);
  const b = byId.get(edge.to);
  if (!a || !b) return null;
  const dim = neighbours !== null && !(neighbours.has(a.id) && neighbours.has(b.id));
  return (
    <g
      className={cn(
        "transition-opacity duration-(--dur-toque) ease-(--ease-pluma)",
        dim ? "opacity-15" : "opacity-70",
      )}
    >
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {edge.label && !dim && (
        <text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 4}
          textAnchor="middle"
          className="fill-muted-foreground stroke-none text-[11px]"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

function GraphNodeButton({
  node,
  dim,
  active,
  hitRadius,
  onOpen,
  onOpenFromKeyboard,
  onHover,
  onLeave,
}: {
  node: LaidOutNode;
  dim: boolean;
  active: boolean;
  hitRadius: number;
  onOpen: (id: string) => void;
  onOpenFromKeyboard: (id: string) => void;
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
}) {
  const r = nodeRadius(node.mentionCount);
  const Icon = ENTITY_TYPE_ICON[node.type];
  const iconSize = Math.min(20, r * 1.1);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.name}, ${ENTITY_TYPE_LABEL[node.type].toLowerCase()}`}
      className={cn(
        "group/nodo cursor-pointer outline-none transition-opacity duration-(--dur-toque) ease-(--ease-pluma)",
        dim && "opacity-25",
      )}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onLeave(node.id)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onLeave(node.id)}
      onClick={() => onOpen(node.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenFromKeyboard(node.id);
        }
      }}
    >
      <title>
        {`${node.name}, ${node.degree === 0 ? "sin relaciones" : `${node.degree} relaciones`}`}
      </title>
      {/* El blanco del dedo: invisible y de 48 px en pantalla sea cual sea el
          zoom, para que un nodo de 10 px se acierte igual que uno grande. */}
      <circle
        data-slot="graph-hit"
        cx={node.x}
        cy={node.y}
        r={hitRadius}
        fill="transparent"
        pointerEvents="all"
      />
      {/* El anillo del foco, el mismo de `focus-ring`: 2 px del acento
          separados del nodo por 2 px de aire. */}
      <circle
        cx={node.x}
        cy={node.y}
        r={r + 4}
        className="fill-none stroke-ring opacity-0 group-focus-visible/nodo:opacity-100"
        strokeWidth={2}
        pointerEvents="none"
      />
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        className={cn(
          "fill-card stroke-border transition-colors duration-(--dur-toque) ease-(--ease-pluma)",
          active && "stroke-primary",
        )}
        strokeWidth={2}
        // Sin una sola relación: borde punteado. Ver de un vistazo qué
        // no está conectado con nada es media razón para abrir el mapa.
        strokeDasharray={node.degree === 0 ? "4 4" : undefined}
      />
      <g
        transform={`translate(${node.x - iconSize / 2} ${node.y - iconSize / 2})`}
        className="text-muted-foreground"
      >
        <Icon width={iconSize} height={iconSize} />
      </g>
      <text
        x={node.x}
        y={node.y + r + 15}
        textAnchor="middle"
        className="fill-foreground text-[13px] font-medium"
      >
        {node.name}
      </text>
    </g>
  );
}
