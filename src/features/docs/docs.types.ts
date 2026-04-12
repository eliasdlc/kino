// TODO(pages-types): Eliminar este archivo cuando src/features/pages/pages.types.ts
// esté implementado. Pasos:
//   1. Crear pages.types.ts con: export type PageListItem = Pick<Page, "id" | "title" | "folderId" | "systemId">
//   2. En PageCard.tsx: cambiar import de "./docs.types" → "@/features/pages/pages.types"
//   3. En DocsView.tsx: cambiar import de "./docs.types" → "@/features/pages/pages.types"
//   4. Borrar este archivo
export type PageListItem = {
  id: string;
  title: string | null;
  folderId: string | null;
  systemId: string;
};
