import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** El manuscrito completo de una obra, tal como lo devuelve Convex. */
export type Manuscript = FunctionReturnType<typeof api.writing.manuscript>;
export type ManuscriptChapter = Manuscript["chapters"][number];
