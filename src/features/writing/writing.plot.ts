import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Loose } from "@/shared/convex/loose";

/** La rejilla de escenas de una obra, tal como la devuelve Convex. */
export type PlotGrid = FunctionReturnType<typeof api.writing.plot>;
export type PlotChapter = PlotGrid["chapters"][number];
export type PlotScene = PlotChapter["scenes"][number];

/** Mover una escena o cambiarle el arco. */
export type PlotOperation = Loose<FunctionArgs<typeof api.writing.applyPlotOperation>["operation"]>;
