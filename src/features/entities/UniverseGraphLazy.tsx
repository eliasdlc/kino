"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * El grafo se carga solo cuando se abre su pestaña. Mismo patrón que las
 * extensiones pesadas del editor (Rumbo 08): la simulación de layout y el
 * lienzo no tienen por qué viajar en el bundle de quien solo lista su codex.
 */
const UniverseGraph = dynamic(
  () => import("./UniverseGraph").then((m) => m.UniverseGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-lg border border-dashed">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

export function UniverseGraphLazy({ systemId }: { systemId: string }) {
  return <UniverseGraph systemId={systemId} />;
}
