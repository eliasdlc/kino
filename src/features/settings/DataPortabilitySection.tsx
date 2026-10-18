"use client";

import { Archive, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReclaimSpaceSection } from "@/features/uploads/ReclaimSpaceSection";
import { useExportImages, useExportWorkspace } from "./settings.hooks";
import { ExportManifestTable } from "./ExportManifestTable";
import { ControlRow } from "./settings-ui";

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
    <div>
      <ControlRow
        icon={<Archive aria-hidden className="size-5 stroke-[1.8]" />}
        title="Exportar los datos"
        meta="Un ZIP con un JSON por tabla y un Markdown por capítulo. Viajan las tablas que la lista de abajo marca."
      >
        <Button variant="outline" disabled={datos.isPending} onClick={() => datos.mutate()}>
          <Download aria-hidden className="size-4" />
          {datos.isPending ? "Preparando el ZIP" : "Exportar ZIP"}
        </Button>
      </ControlRow>

      <ControlRow
        icon={<ImageIcon aria-hidden className="size-5 stroke-[1.8]" />}
        title="Exportar las imágenes"
        meta="Van aparte porque bajarlas tarda. Descomprime este ZIP al lado del otro y los enlaces de los Markdown quedan en su sitio."
      >
        <Button variant="outline" disabled={imagenes.isPending} onClick={() => imagenes.mutate()}>
          <ImageIcon aria-hidden className="size-4" />
          {imagenes.isPending ? "Bajando las imágenes" : "Bajar imágenes"}
        </Button>
      </ControlRow>

      <div className="space-y-6 pt-4 pl-(--margen)">
        <ExportManifestTable />
        <ReclaimSpaceSection />
      </div>
    </div>
  );
}
