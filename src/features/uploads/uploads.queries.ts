import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/shared/db";
import { pages, entities, users } from "@/shared/db/schema";
import { extractImageUrlsFromHtml } from "./image-refs";

/** Usuarios a barrer en el pase del cron. */
export async function getAllUserIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.map((row) => row.id);
}

/**
 * Todas las imágenes que el contenido vivo del usuario todavía referencia.
 *
 * Es la mitad que decide qué **no** se borra en el barrido de huérfanas, así que
 * una fuente de referencias que falte aquí es una imagen que desaparece de una
 * pantalla que la usaba. Hoy son tres: el HTML de las páginas, la portada de cada
 * ficha del Codex y su galería.
 *
 * Se filtra por `deletedAt IS NULL` a propósito: en Kino la papelera de páginas y
 * de entidades no tiene camino de vuelta — `deletedAt` es una lápida, no un
 * estado reversible. **Si algún día se añade "restaurar", esta consulta tiene que
 * dejar de excluirlas**, o restaurar devolverá la página con las imágenes rotas.
 */
export async function getReferencedImageUrls(userId: string): Promise<Set<string>> {
  const [pageRows, entityRows] = await Promise.all([
    db
      .select({ content: pages.content })
      .from(pages)
      .where(and(eq(pages.userId, userId), isNull(pages.deletedAt))),
    db
      .select({ cover: entities.coverImageUrl, images: entities.images })
      .from(entities)
      .where(and(eq(entities.userId, userId), isNull(entities.deletedAt))),
  ]);

  const referenced = new Set<string>();

  for (const row of pageRows) {
    for (const url of extractImageUrlsFromHtml(row.content)) {
      referenced.add(url);
    }
  }

  for (const row of entityRows) {
    if (row.cover) referenced.add(row.cover);
    for (const url of row.images ?? []) {
      if (url) referenced.add(url);
    }
  }

  return referenced;
}
