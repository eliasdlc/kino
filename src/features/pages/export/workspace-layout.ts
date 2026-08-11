/**
 * Disposición de archivos dentro del ZIP del export.
 *
 * Vive aparte del route porque las rutas de las imágenes en el Markdown son
 * *relativas al `.md`*, no al ZIP: el `../../` depende de a qué profundidad cuelgan
 * las páginas. Con las dos cosas en el mismo módulo, mover las páginas de sitio
 * rompe un test en vez de romper las imágenes en silencio.
 */

/** Carpeta de imágenes en la raíz del ZIP, compartida por todos los sistemas. */
export const ASSETS_DIR = "assets";

/** Carpeta de páginas de un sistema, relativa a la raíz del ZIP. */
export function pageDir(systemSlug: string): string {
  return `${systemSlug}/pages`;
}

/** Ruta de una imagen tal y como debe escribirse dentro de un `.md` de página. */
export function assetPathFromPage(fileName: string): string {
  // Tantos `..` como niveles tiene `pageDir` (`<sistema>/pages` → dos).
  const depth = pageDir("x").split("/").length;
  return `${"../".repeat(depth)}${ASSETS_DIR}/${fileName}`;
}
