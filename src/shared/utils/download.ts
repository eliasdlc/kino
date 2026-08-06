/**
 * Descarga de archivos generados en el cliente. Vive en `shared` porque lo usan
 * el export por página del editor y la compilación de la obra completa
 * (KIN-139), y las dos tienen que producir el mismo nombre de archivo.
 */

/** Nombre de archivo seguro a partir de un título libre. */
export function slugify(title: string): string {
  return (
    (title || "")
      .normalize("NFD")
      // Quitar los diacríticos antes de filtrar: "canción" debe dar "cancion",
      // no "canci-n".
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sin-titulo"
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
