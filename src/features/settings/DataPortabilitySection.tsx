"use client";

import { Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReclaimSpaceSection } from "@/features/uploads/ReclaimSpaceSection";
import { useExportImages, useExportWorkspace } from "./settings.hooks";
import { ExportManifestTable } from "./ExportManifestTable";

/**
 * Irse de Kino con todo. Dos descargas y no una: los datos primero, que es lo
 * que cabe en el presupuesto de la ruta, y las imágenes por su propio enlace.
 * Debajo, el manifiesto, porque esta es la pantalla donde alguien decide si
 * confía en poder irse y ahí una promesa sin comprobante es la más cara de
 * todas.
 */
export function DataPortabilitySection() {
  const datos = useExportWorkspace();
  const imagenes = useExportImages();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Datos y portabilidad</h2>
        <p className="text-sm text-muted-foreground">
          Bájate tu workspace entero: un JSON por tabla para reimportarlo y un Markdown por
          capítulo para leerlo en cualquier otra herramienta.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Exportar los datos</p>
          <p className="text-xs text-muted-foreground">
            Un ZIP con un JSON por tabla y un Markdown por capítulo. Las tablas que viajan son las
            que la lista de abajo marca.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={datos.isPending}
          onClick={() => datos.mutate()}
        >
          <Download className="size-4" />
          {datos.isPending ? "Preparando el ZIP" : "Exportar ZIP"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Exportar las imágenes</p>
          <p className="text-xs text-muted-foreground">
            Van aparte porque bajarlas tarda. Descomprime este ZIP al lado del otro y los enlaces
            de los Markdown quedan en su sitio.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={imagenes.isPending}
          onClick={() => imagenes.mutate()}
        >
          <ImageIcon className="size-4" />
          {imagenes.isPending ? "Bajando las imágenes" : "Bajar imágenes"}
        </Button>
      </div>

      <ExportManifestTable />

      <ReclaimSpaceSection />
    </div>
  );
}
