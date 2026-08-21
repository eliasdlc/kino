/**
 * Query key factories de sticky notes. Módulo aparte por la misma razón que
 * `pages.keys.ts`: lo consume el registro de creaciones offline sin arrastrar los
 * hooks ni crear un ciclo de imports.
 */

export const stickyNoteKeys = {
  byPage: (pageId: string) => ["sticky-notes", "page", pageId] as const,
  byFolder: (folderId: string) => ["sticky-notes", "folder", folderId] as const,
};
