import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { getServerSession } from "@/shared/utils/session";
import { htmlToMarkdown } from "@/features/pages/export/html-to-markdown";
import { getImageStorage } from "@/features/uploads/image-storage";
import { extractImageUrlsFromHtml, rewriteImageUrls } from "@/features/uploads/image-refs";
import { bundleImages } from "@/features/uploads/image-bundle";
import { ASSETS_DIR, pageDir, assetPathFromPage } from "@/features/pages/export/workspace-layout";

function slugify(str: string): string {
  return (str || "sin-nombre")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nombre único dentro de una carpeta del ZIP: dos páginas homónimas no se pisan. */
function uniqueSlug(base: string, used: Set<string>): string {
  let candidate = base;
  for (let i = 2; used.has(candidate); i += 1) {
    candidate = `${base}-${i}`;
  }
  used.add(candidate);
  return candidate;
}

export async function GET(_request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const systems = await serverQuery(api.systems.list, {});

  // Primera pasada: leer todo y juntar las imágenes referenciadas. Hay que conocer
  // el mapa completo de URL → archivo antes de serializar ningún Markdown.
  const loaded = await Promise.all(
    systems.map(async (system) => {
      const [tasks, folders, pages] = await Promise.all([
        serverQuery(api.tasks.bySystem, { systemId: system.id }),
        serverQuery(api.folders.bySystem, { systemId: system.id }),
        serverQuery(api.pages.forExport, { systemId: system.id }),
      ]);
      return { system, tasks, folders, pages };
    }),
  );

  const referenced = new Set<string>();
  for (const { pages } of loaded) {
    for (const page of pages) {
      for (const url of extractImageUrlsFromHtml(page.content)) {
        referenced.add(url);
      }
    }
  }

  const storage = getImageStorage();
  const bundled =
    storage && referenced.size > 0
      ? await bundleImages([...referenced], storage)
      : { files: [], byUrl: new Map<string, string>(), skipped: 0 };

  // Las rutas del Markdown son relativas al archivo `.md`, no al ZIP.
  const rewrites = new Map(
    [...bundled.byUrl].map(([url, name]) => [url, assetPathFromPage(name)]),
  );

  // Segunda pasada: montar el ZIP.
  const zip = new JSZip();

  if (bundled.files.length > 0) {
    const assets = zip.folder(ASSETS_DIR)!;
    for (const file of bundled.files) {
      // Sin DEFLATE: WebP, PNG y JPEG ya vienen comprimidos, así que volver a
      // pasarlos por el compresor gasta del presupuesto de 10s sin ganar bytes.
      assets.file(file.name, file.data, { compression: "STORE" });
    }
  }

  const usedSystemSlugs = new Set<string>();
  for (const { system, tasks, folders, pages } of loaded) {
    const systemSlug = uniqueSlug(slugify(system.name), usedSystemSlugs);
    const folder = zip.folder(systemSlug)!;

    folder.file("system.json", JSON.stringify(system, null, 2));
    folder.file("tasks.json", JSON.stringify(tasks, null, 2));
    folder.file("folders.json", JSON.stringify(folders, null, 2));

    // Vía `pageDir` y no `folder.folder("pages")`: la profundidad de esta carpeta
    // es la misma que calcula `assetPathFromPage`, y deben salir del mismo sitio.
    const pagesFolder = zip.folder(pageDir(systemSlug))!;
    const usedPageSlugs = new Set<string>();
    for (const page of pages) {
      const slug = uniqueSlug(slugify(page.title ?? "sin-titulo"), usedPageSlugs);
      // El JSON conserva las URLs originales a propósito: es la copia cruda del
      // dato, y reimportarlo no debería depender de dónde cayó el archivo.
      pagesFolder.file(`${slug}.json`, JSON.stringify(page, null, 2));
      if (page.content) {
        pagesFolder.file(`${slug}.md`, htmlToMarkdown(rewriteImageUrls(page.content, rewrites)));
      }
    }
  }

  const uint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="kino-workspace.zip"',
      // Permite a la UI avisar de que el export salió incompleto sin abrir el ZIP.
      "X-Kino-Images-Bundled": String(bundled.files.length),
      "X-Kino-Images-Skipped": String(bundled.skipped),
    },
  });
}
