import { NextResponse } from "next/server";
import JSZip from "jszip";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { getServerSession } from "@/shared/utils/session";
import { getImageStorage } from "@/features/uploads/image-storage";
import { extractImageUrlsFromHtml } from "@/features/uploads/image-refs";
import { bundleImages } from "@/features/uploads/image-bundle";
import { ASSETS_DIR } from "@/features/pages/export/workspace-layout";

/**
 * Las imágenes del workspace, en su propio ZIP y con su propio presupuesto.
 *
 * Salieron del ZIP de datos porque descargarlas es lo único del export que
 * depende de la red, y con las veintidós tablas dentro las dos cosas juntas ya
 * no caben en diez segundos. Aquí el ZIP trae `assets/` en la raíz: se
 * descomprime al lado del de datos y los enlaces de los `.md` quedan bien sin
 * tocar nada.
 */
export const maxDuration = 10;

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { tablas } = await serverQuery(api.portabilidad.workspace, {});
  const paginas = (tablas.pages ?? []) as Array<Record<string, unknown>>;
  const referenced = new Set<string>();
  for (const pagina of paginas) {
    for (const url of extractImageUrlsFromHtml(typeof pagina.content === "string" ? pagina.content : "")) {
      referenced.add(url);
    }
  }

  const storage = getImageStorage();
  const bundled =
    storage && referenced.size > 0
      ? await bundleImages([...referenced], storage)
      : { files: [], byUrl: new Map<string, string>(), skipped: 0 };

  const zip = new JSZip();
  const assets = zip.folder(ASSETS_DIR)!;
  for (const file of bundled.files) {
    // Sin DEFLATE: WebP, PNG y JPEG ya vienen comprimidos, así que volver a
    // pasarlos por el compresor gasta presupuesto sin ganar bytes.
    assets.file(file.name, file.data, { compression: "STORE" });
  }

  const uint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="kino-imagenes.zip"',
      "X-Kino-Images-Bundled": String(bundled.files.length),
      "X-Kino-Images-Skipped": String(bundled.skipped),
    },
  });
}
