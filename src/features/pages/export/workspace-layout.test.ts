import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import path from "node:path";
import { ASSETS_DIR, pageDir, assetPathFromPage } from "./workspace-layout";

describe("disposición del ZIP del export", () => {
  it("la ruta de la imagen resuelve al archivo real dentro del ZIP", async () => {
    // Se monta un ZIP con la misma forma que produce el route y se comprueba que
    // la ruta escrita en el Markdown apunta de verdad al asset. Es lo que decide
    // si el ZIP descargado abre con las imágenes visibles.
    const zip = new JSZip();
    zip.folder(ASSETS_DIR)!.file("foto.webp", new Uint8Array([1, 2, 3]));

    const mdPath = `${pageDir("mi-sistema")}/mi-pagina.md`;
    const rel = assetPathFromPage("foto.webp");
    zip.file(mdPath, `![La torre](${rel})\n`);

    const read = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" }));
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(mdPath), rel));

    expect(resolved).toBe(`${ASSETS_DIR}/foto.webp`);
    expect(read.file(resolved)).not.toBeNull();
  });

  it("la ruta no se escapa de la raíz del ZIP", () => {
    const mdPath = `${pageDir("s")}/p.md`;
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(mdPath), assetPathFromPage("x.webp")),
    );
    expect(resolved.startsWith("..")).toBe(false);
  });

  it("sube un nivel por cada segmento de la carpeta de páginas", () => {
    expect(pageDir("mi-sistema")).toBe("mi-sistema/pages");
    expect(assetPathFromPage("x.webp")).toBe("../../assets/x.webp");
  });
});
