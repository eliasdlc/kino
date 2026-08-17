import { registerTaskCrudTools } from './crud/tasks-crud.js';
import { registerTaskBulkTools } from './crud/tasks-bulk.js';
import { registerSystemCrudTools } from './crud/systems-crud.js';
import { registerPageCrudTools } from './crud/pages-crud.js';
import { registerLearningTools } from './learning.js';
import { registerFolderCrudTools } from './crud/folders-crud.js';
import { registerStickyNoteCrudTools } from './crud/sticky-notes-crud.js';
import { registerEnergyTools } from './energy.js';
import { registerStoryTools } from './story.js';
import { registerContextTools } from './intelligence/context.js';
import { registerAnalyzeTools } from './intelligence/analyze.js';
import { registerSuggestTools } from './intelligence/suggest.js';
import { registerClassifyTools } from './intelligence/classify.js';
import { registerDecomposeTools } from './decompose.js';
/**
 * Registers the full Kino tool set on an MCP server, wired to a given fetcher.
 * Shared by the stdio server (env-based fetcher) and the remote HTTP route
 * (per-request OAuth-token fetcher) so both expose an identical tool surface.
 */
export function registerAllKinoTools(server, kinoFetch) {
    registerTaskCrudTools(server, kinoFetch);
    registerTaskBulkTools(server, kinoFetch);
    registerSystemCrudTools(server, kinoFetch);
    registerPageCrudTools(server, kinoFetch);
    registerLearningTools(server, kinoFetch);
    registerFolderCrudTools(server, kinoFetch);
    registerStickyNoteCrudTools(server, kinoFetch);
    registerEnergyTools(server, kinoFetch);
    registerStoryTools(server, kinoFetch);
    registerContextTools(server, kinoFetch);
    registerAnalyzeTools(server, kinoFetch);
    registerSuggestTools(server, kinoFetch);
    registerClassifyTools(server, kinoFetch);
    registerDecomposeTools(server, kinoFetch);
}
