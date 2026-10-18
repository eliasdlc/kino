"use client";

import dynamic from "next/dynamic";

/**
 * La espera del grafo, con la forma y la altura del lienzo que viene: la fila de
 * filtros, el lienzo de `h-[28rem] md:h-[34rem]` y la barra de zoom debajo.
 * Quieta a propósito, sin pulso ni giro: lo que llega se pinta encima en el
 * mismo sitio y la página no salta. Vive aquí y no en `UniverseGraph` porque la
 * usan los dos: este fallback y la carga de la query.
 */
export function GraphSkeleton() {
  return (
    <div role="status" aria-busy className="space-y-3">
      <span className="sr-only">Trazando el universo</span>
      <div aria-hidden className="h-[1.625rem] w-56 max-w-full rounded-full bg-muted pointer-coarse:h-[2.85rem]" />
      <div aria-hidden className="overflow-hidden rounded-lg border bg-muted/10">
        <div className="h-[28rem] md:h-[34rem]" />
        <div className="h-[3.6rem] border-t md:pointer-fine:h-[3.25rem]" />
      </div>
    </div>
  );
}

/**
 * El grafo se carga solo cuando se abre su pestaña. Mismo patrón que las
 * extensiones pesadas del editor (Rumbo 08): la simulación de layout y el
 * lienzo no tienen por qué viajar en el bundle de quien solo lista su codex.
 */
const UniverseGraph = dynamic(
  () => import("./UniverseGraph").then((m) => m.UniverseGraph),
  {
    ssr: false,
    loading: () => <GraphSkeleton />,
  },
);

export function UniverseGraphLazy({ systemId }: { systemId: string }) {
  return <UniverseGraph systemId={systemId} />;
}
