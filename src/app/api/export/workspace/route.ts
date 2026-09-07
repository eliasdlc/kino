import { NextResponse } from "next/server";
import JSZip from "jszip";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { getServerSession } from "@/shared/utils/session";
import { htmlToMarkdown } from "@/features/pages/export/html-to-markdown";
import { extractImageUrlsFromHtml, rewriteImageUrls, assetFileName } from "@/features/uploads/image-refs";
import { pageDir, assetPathFromPage } from "@/features/pages/export/workspace-layout";
import { DATA_DIR, EXPORT_TABLES } from "@/features/settings/export-manifest";
import { IMAGES_PATH } from "../images/route";

/**
 * El ZIP de datos: un JSON por tabla, tal cual sale de la base, y un Markdown
 * por capítulo para que otra herramienta lo lea sin Kino delante.
 *
 * **Las imágenes viajan por su propio enlace** (`/api/export/images`). Antes
 * salían aquí dentro, y con las veintidós tablas y las versiones de capítulo en
 * memoria eso ya no cabe en el presupuesto de diez segundos: el export dejaba de
 * ser lento en silencio para pasar a ser un 504 que se lee. Partirlo es lo que
 * mantiene el ZIP de datos por debajo del tope, y el manifiesto lo dice para que
 * nadie crea que las imágenes se perdieron.
 *
 * Los `.md` referencian las imágenes con la misma ruta relativa de siempre, así
 * que descomprimir el segundo ZIP al lado del primero deja las imágenes en su
 * sitio sin tocar un solo enlace.
 */
export const maxDuration = 10;

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

type Fila = Record<string, unknown>;

export async function GET() {
  // Ruta fuera de Convex: no hereda el modelo de alcances, así que la
  // comprobación es explícita. `getServerSession` exige sesión de navegador,
  // que es lo que deja fuera a un token del conector MCP.
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { tablas, topadas, tope } = await serverQuery(api.portabilidad.workspace, {});
  const zip = new JSZip();

  const datos = zip.folder(DATA_DIR)!;
  for (const { tabla } of EXPORT_TABLES) {
    if (!(tabla in tablas)) continue;
    datos.file(`${tabla}.json`, JSON.stringify(tablas[tabla], null, 2));
  }

  // El Markdown, para leerlo fuera: una carpeta por sistema y un archivo por
  // capítulo, con las imágenes apuntando a donde caerán al descomprimir el
  // segundo ZIP.
  const sistemas = (tablas.systems ?? []) as Fila[];
  const paginas = (tablas.pages ?? []) as Fila[];
  const slugPorSistema = new Map<string, string>();
  const usadosSistema = new Set<string>();
  for (const sistema of sistemas) {
    slugPorSistema.set(String(sistema._id), uniqueSlug(slugify(String(sistema.name ?? "")), usadosSistema));
  }

  const usadosPagina = new Map<string, Set<string>>();
  let imagenes = 0;
  for (const pagina of paginas) {
    const contenido = typeof pagina.content === "string" ? pagina.content : "";
    const sistemaSlug = slugPorSistema.get(String(pagina.systemId)) ?? "sin-sistema";
    const usados = usadosPagina.get(sistemaSlug) ?? new Set<string>();
    usadosPagina.set(sistemaSlug, usados);
    const slug = uniqueSlug(slugify(String(pagina.title ?? "sin-titulo")), usados);
    if (!contenido) continue;
    const urls = extractImageUrlsFromHtml(contenido);
    imagenes += urls.length;
    const rewrites = new Map(urls.map((url) => [url, assetPathFromPage(assetFileName(url))]));
    zip.folder(pageDir(sistemaSlug))!.file(`${slug}.md`, htmlToMarkdown(rewriteImageUrls(contenido, rewrites)));
  }

  zip.file(
    "manifiesto.json",
    JSON.stringify(
      {
        generado: new Date().toISOString(),
        tablas: EXPORT_TABLES.map(({ tabla, etiqueta, formato, motivo }) => ({
          tabla,
          etiqueta,
          viaja: formato !== null,
          formato,
          ...(motivo ? { motivo } : {}),
          ...(formato !== null ? { filas: (tablas[tabla] ?? []).length } : {}),
        })),
        /** Tablas que llegaron al tope de documentos: su JSON está recortado. */
        recortadas: topadas,
        tope,
        imagenes: { referenciadas: imagenes, enlace: IMAGES_PATH },
      },
      null,
      2,
    ),
  );

  const uint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="kino-workspace.zip"',
      // Permite a la UI avisar de un export recortado sin abrir el ZIP.
      "X-Kino-Tables": String(EXPORT_TABLES.filter((t) => t.formato !== null).length),
      "X-Kino-Truncated": topadas.join(",") || "none",
    },
  });
}
