import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** Una carpeta en una lista, con sus cuentas de contenido directo. */
export type FolderWithCounts = FunctionReturnType<typeof api.folders.bySystem>[number];

export type FolderListItem = Omit<FolderWithCounts, "subfolderCount" | "pageCount">;

/** Una carpeta con su rastro de migas. */
export type FolderDetail = FunctionReturnType<typeof api.folders.detail>;

export type BreadcrumbItem = FolderDetail["breadcrumb"][number];

export type FolderNode = FunctionReturnType<typeof api.folders.tree>[number];
