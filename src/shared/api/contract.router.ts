import { accountContract } from "@/features/account/account.contract";
import { apiKeysContract } from "@/features/api-keys/api-keys.contract";
import { energyContract } from "@/features/energy/energy.contract";
import { entitiesContract } from "@/features/entities/entities.contract";
import { githubContract } from "@/features/github-sync/github-sync.contract";
import { foldersContract } from "@/features/folders/folders.contract";
import { pagesContract } from "@/features/pages/pages.contract";
import { insightsContract } from "@/features/insights/insights.contract";
import { writingContract } from "@/features/writing/writing.contract";
import { notificationsContract } from "@/features/notifications/notifications.contract";
import { onboardingContract } from "@/features/onboarding/onboarding.contract";
import { searchContract } from "@/features/search/search.contract";
import { settingsContract } from "@/features/settings/settings.contract";
import { sprintsContract } from "@/features/sprints/sprints.contract";
import { stickyNotesContract } from "@/features/sticky-notes/sticky-notes.contract";
import { systemsContract } from "@/features/systems/systems.contract";
import { tagsContract } from "@/features/tags/tags.contract";
import { tasksContract } from "@/features/tasks/tasks.contract";

/**
 * El contrato completo, que es lo único que el cliente necesita importar. No
 * arrastra ni servicios ni base de datos: por eso el cliente puede tiparse
 * entero sin que nada del servidor entre en el bundle.
 */
export const apiContract = {
  account: accountContract,
  apiKeys: apiKeysContract,
  energy: energyContract,
  entities: entitiesContract,
  folders: foldersContract,
  github: githubContract,
  insights: insightsContract,
  notifications: notificationsContract,
  onboarding: onboardingContract,
  pages: pagesContract,
  search: searchContract,
  settings: settingsContract,
  sprints: sprintsContract,
  stickyNotes: stickyNotesContract,
  systems: systemsContract,
  tags: tagsContract,
  tasks: tasksContract,
  writing: writingContract,
};
