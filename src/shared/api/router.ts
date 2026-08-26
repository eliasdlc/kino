import { foldersRouter } from "@/features/folders/folders.router";
import { onboardingRouter } from "@/features/onboarding/onboarding.router";
import { searchRouter } from "@/features/search/search.router";
import { settingsRouter } from "@/features/settings/settings.router";
import { sprintsRouter } from "@/features/sprints/sprints.router";
import { stickyNotesRouter } from "@/features/sticky-notes/sticky-notes.router";
import { systemsRouter } from "@/features/systems/systems.router";
import { tagsRouter } from "@/features/tags/tags.router";
import { tasksRouter } from "@/features/tasks/tasks.router";

/**
 * Los slices que ya se sirven desde su contrato. Lo que no esté aquí sigue
 * viviendo en su propio `route.ts` con el wrapper `route()`, y las dos formas
 * conviven: Next resuelve primero el archivo más específico y sólo lo que
 * ninguno reclama llega al handler del contrato.
 *
 * Esta composición es lo único central; la definición de cada contrato vive en
 * su slice, al lado de sus schemas.
 */
export const apiRouter = {
  folders: foldersRouter,
  onboarding: onboardingRouter,
  search: searchRouter,
  settings: settingsRouter,
  sprints: sprintsRouter,
  stickyNotes: stickyNotesRouter,
  systems: systemsRouter,
  tags: tagsRouter,
  tasks: tasksRouter,
};
