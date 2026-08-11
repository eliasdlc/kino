/**
 * Query key factories de cuadernos.
 *
 * Módulo aparte (sin hooks, sin "use client") por la misma razón que
 * `tasks.keys.ts`: se importan desde componentes de servidor y de cliente, y
 * ahora también desde el registro de creaciones offline, que necesita saber qué
 * listas toca una creación sin arrastrar los hooks —y sin crear un ciclo de
 * imports con ellos.
 */

export const pageKeys = {
  bySystem: (systemId: string) => ["pages", "system", systemId] as const,
  detail: (pageId: string) => ["pages", "detail", pageId] as const,
  linkedTasks: (pageId: string) => ["pages", "tasks", pageId] as const,
  tags: (pageId: string) => ["pages", "tags", pageId] as const,
  subPages: (pageId: string) => ["pages", "subpages", pageId] as const,
};
