import { accountRouter } from "@/features/account/account.router";
import { apiKeysRouter } from "@/features/api-keys/api-keys.router";
import { energyRouter } from "@/features/energy/energy.router";
import { entitiesRouter } from "@/features/entities/entities.router";
import { githubRouter } from "@/features/github-sync/github-sync.router";
import { foldersRouter } from "@/features/folders/folders.router";
import { pagesRouter } from "@/features/pages/pages.router";
import { insightsRouter } from "@/features/insights/insights.router";
import { writingRouter } from "@/features/writing/writing.router";
import { notificationsRouter } from "@/features/notifications/notifications.router";
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
  account: accountRouter,
  apiKeys: apiKeysRouter,
  energy: energyRouter,
  entities: entitiesRouter,
  folders: foldersRouter,
  github: githubRouter,
  insights: insightsRouter,
  notifications: notificationsRouter,
  onboarding: onboardingRouter,
  pages: pagesRouter,
  search: searchRouter,
  settings: settingsRouter,
  sprints: sprintsRouter,
  stickyNotes: stickyNotesRouter,
  systems: systemsRouter,
  tags: tagsRouter,
  tasks: tasksRouter,
  writing: writingRouter,
};
