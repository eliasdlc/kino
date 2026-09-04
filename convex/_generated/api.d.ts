/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as folders from "../folders.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_fn from "../lib/fn.js";
import type * as lib_fnFixture from "../lib/fnFixture.js";
import type * as lib_lemas from "../lib/lemas.js";
import type * as lib_scopes from "../lib/scopes.js";
import type * as lib_tasks_schemas from "../lib/tasks/schemas.js";
import type * as lib_tasks_status from "../lib/tasks/status.js";
import type * as lib_time from "../lib/time.js";
import type * as migrate from "../migrate.js";
import type * as stickyNotes from "../stickyNotes.js";
import type * as systems from "../systems.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  folders: typeof folders;
  "lib/errors": typeof lib_errors;
  "lib/fn": typeof lib_fn;
  "lib/fnFixture": typeof lib_fnFixture;
  "lib/lemas": typeof lib_lemas;
  "lib/scopes": typeof lib_scopes;
  "lib/tasks/schemas": typeof lib_tasks_schemas;
  "lib/tasks/status": typeof lib_tasks_status;
  "lib/time": typeof lib_time;
  migrate: typeof migrate;
  stickyNotes: typeof stickyNotes;
  systems: typeof systems;
  tasks: typeof tasks;
  users: typeof users;
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
