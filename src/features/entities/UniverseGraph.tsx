"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, Minus, Network, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ENTITY_TYPE_ICON, ENTITY_TYPE_LABEL_PLURAL } from "./entities.ui";
import {
  filterGraph,
  layoutGraph,
  nodeRadius,
  type GraphLayout,
} from "./entities.graph";

/**
 * Mapa visual del universo (KIN-136). Es **solo render**: nada que capturar, nada
 * que migrar — las relaciones ya están en `entity_relations` desde W2.
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

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-dashed">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = data?.nodes.length ?? 0;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Network className="mx-auto size-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">No hay universo que dibujar</p>
        <p className="mt-1 text-sm text-muted-foreground">
          El mapa aparece cuando existen entidades. Menciónalas con @ mientras
          escribes o créalas en la biblioteca.
        </p>
      </div>
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
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-primary/40 bg-accent text-foreground"
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
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ninguna entidad cumple el filtro.
        </div>
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

export interface GraphCanvasProps {
  layout: GraphLayout;
  onOpen: (entityId: string) => void;
}

/** El lienzo, separado del contenedor con filtros para poder sembrarlo en `/system-design`. */
export function GraphCanvas({ layout, onOpen }: GraphCanvasProps) {
  const initial: ViewBox = { x: 0, y: 0, w: layout.size, h: layout.size };
  const [view, setView] = useState<ViewBox>(initial);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const byId = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout.nodes],
  );

  // Vecinos del nodo bajo el cursor: resaltar su barrio es la lectura que hace
  // útil un grafo denso ("¿con quién converge este personaje?").
  const neighbours = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const e of layout.edges) {
      if (e.from === hoverId) set.add(e.to);
      if (e.to === hoverId) set.add(e.from);
    }
    return set;
  }, [hoverId, layout.edges]);

  function zoom(factor: number) {
    setView((v) => {
      const w = Math.min(layout.size * 2, Math.max(MIN_SPAN, v.w / factor));
      const h = w;
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    });
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    // El desplazamiento del ratón está en píxeles; el viewBox, en unidades del
    // lienzo. La escala entre ambos es lo que hace que el arrastre no se sienta
    // ni lento ni disparado cuando hay zoom.
    const scale = view.w / rect.width;
    setView((v) => ({
      ...v,
      x: v.x - (e.clientX - state.x) * scale,
      y: v.y - (e.clientY - state.y) * scale,
    }));
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  }

  function endDrag(e: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted/10">
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        <Button variant="outline" size="icon" className="size-8" onClick={() => zoom(ZOOM_STEP)} aria-label="Acercar">
          <Plus className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="size-8" onClick={() => zoom(1 / ZOOM_STEP)} aria-label="Alejar">
          <Minus className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="size-8" onClick={() => setView(initial)} aria-label="Ajustar a la vista">
          <Maximize2 className="size-4" />
        </Button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="h-[28rem] w-full touch-none select-none md:h-[34rem]"
        role="img"
        aria-label="Grafo del universo"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <g className="stroke-border" strokeWidth={1.5}>
          {layout.edges.map((edge) => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return null;
            const dim = neighbours !== null && !(neighbours.has(a.id) && neighbours.has(b.id));
            return (
              <g key={edge.id} className={cn("transition-opacity", dim ? "opacity-15" : "opacity-70")}>
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
          })}
        </g>

        {layout.nodes.map((node) => {
          const r = nodeRadius(node.mentionCount);
          const Icon = ENTITY_TYPE_ICON[node.type];
          const dim = neighbours !== null && !neighbours.has(node.id);
          const iconSize = Math.min(20, r * 1.1);
          return (
            <g
              key={node.id}
              className={cn("cursor-pointer transition-opacity", dim && "opacity-25")}
              onPointerEnter={() => setHoverId(node.id)}
              onPointerLeave={() => setHoverId((cur) => (cur === node.id ? null : cur))}
              onClick={() => onOpen(node.id)}
            >
              <title>
                {`${node.name} · ${node.degree === 0 ? "sin relaciones" : `${node.degree} relaciones`}`}
              </title>
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                className={cn(
                  "fill-card stroke-border transition-colors",
                  hoverId === node.id && "stroke-primary",
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
        })}
      </svg>
    </div>
  );
}
