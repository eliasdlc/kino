/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as energy from "../energy.js";
import type * as entities from "../entities.js";
import type * as folders from "../folders.js";
import type * as github from "../github.js";
import type * as githubData from "../githubData.js";
import type * as insights from "../insights.js";
import type * as lib_energy_curve from "../lib/energy/curve.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_fn from "../lib/fn.js";
import type * as lib_fnFixture from "../lib/fnFixture.js";
import type * as lib_lemas from "../lib/lemas.js";
import type * as lib_mentions from "../lib/mentions.js";
import type * as lib_scopes from "../lib/scopes.js";
import type * as lib_tasks_row from "../lib/tasks/row.js";
import type * as lib_tasks_schemas from "../lib/tasks/schemas.js";
import type * as lib_tasks_status from "../lib/tasks/status.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_writing_activity from "../lib/writing/activity.js";
import type * as migrate from "../migrate.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as pages from "../pages.js";
import type * as pushSend from "../pushSend.js";
import type * as search from "../search.js";
import type * as settings from "../settings.js";
import type * as sprints from "../sprints.js";
import type * as stickyNotes from "../stickyNotes.js";
import type * as systems from "../systems.js";
import type * as tags from "../tags.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";
import type * as writing from "../writing.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  energy: typeof energy;
  entities: typeof entities;
  folders: typeof folders;
  github: typeof github;
  githubData: typeof githubData;
  insights: typeof insights;
  "lib/energy/curve": typeof lib_energy_curve;
  "lib/errors": typeof lib_errors;
  "lib/fn": typeof lib_fn;
  "lib/fnFixture": typeof lib_fnFixture;
  "lib/lemas": typeof lib_lemas;
  "lib/mentions": typeof lib_mentions;
  "lib/scopes": typeof lib_scopes;
  "lib/tasks/row": typeof lib_tasks_row;
  "lib/tasks/schemas": typeof lib_tasks_schemas;
  "lib/tasks/status": typeof lib_tasks_status;
  "lib/time": typeof lib_time;
  "lib/writing/activity": typeof lib_writing_activity;
  migrate: typeof migrate;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  pages: typeof pages;
  pushSend: typeof pushSend;
  search: typeof search;
  settings: typeof settings;
  sprints: typeof sprints;
  stickyNotes: typeof stickyNotes;
  systems: typeof systems;
  tags: typeof tags;
  tasks: typeof tasks;
  users: typeof users;
  writing: typeof writing;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
