// Qué tabla de Drizzle alimenta cada tabla de Convex que viaja.
import type { ImportableTable } from '../../convex/migrate';
import * as pg from '../../src/shared/db/schema';

export const PG_TABLES = {
  users: pg.users,
  userSettings: pg.userSettings,
  userEnergyProfile: pg.userEnergyProfile,
  systems: pg.systems,
  contextTags: pg.contextTags,
  systemStatusDefinitions: pg.systemStatusDefinitions,
  sprints: pg.sprints,
  folders: pg.folders,
  tasks: pg.tasks,
  pages: pg.pages,
  stickyNotes: pg.stickyNotes,
  pageSnapshots: pg.pageSnapshots,
  entities: pg.entities,
  entityRelations: pg.entityRelations,
  taskPageLinks: pg.taskPageLinks,
  pageTags: pg.pageTags,
  pageEntityMentions: pg.pageEntityMentions,
  taskReminders: pg.taskReminders,
  timeLogs: pg.timeLogs,
  syncConnections: pg.syncConnections,
  pushSubscriptions: pg.pushSubscriptions,
  energyCheckins: pg.energyCheckins,
  energyPredictions: pg.energyPredictions,
  behaviorSnapshots: pg.behaviorSnapshots,
  cronRuns: pg.cronRuns,
  rateLimits: pg.rateLimits,
} satisfies Record<ImportableTable, unknown>;
