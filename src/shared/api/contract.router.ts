import { foldersContract } from "@/features/folders/folders.contract";
import { searchContract } from "@/features/search/search.contract";
import { settingsContract } from "@/features/settings/settings.contract";
import { sprintsContract } from "@/features/sprints/sprints.contract";
import { stickyNotesContract } from "@/features/sticky-notes/sticky-notes.contract";
import { tagsContract } from "@/features/tags/tags.contract";
import { tasksContract } from "@/features/tasks/tasks.contract";

/**
 * El contrato completo, que es lo único que el cliente necesita importar. No
 * arrastra ni servicios ni base de datos: por eso el cliente puede tiparse
 * entero sin que nada del servidor entre en el bundle.
 */
export const apiContract = {
  folders: foldersContract,
  search: searchContract,
  settings: settingsContract,
  sprints: sprintsContract,
  stickyNotes: stickyNotesContract,
  tags: tagsContract,
  tasks: tasksContract,
};
