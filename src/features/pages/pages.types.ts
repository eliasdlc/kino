import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** Una página en lista: sin el contenido, con su vista previa y sus etiquetas. */
export type PageListItem = FunctionReturnType<typeof api.pages.bySystem>["items"][number];

/** La página entera, con contenido y tareas enlazadas. */
export type PageDetail = FunctionReturnType<typeof api.pages.byId>;

export type Page = PageDetail;

export type LinkedTask = FunctionReturnType<typeof api.pages.linkedTasks>[number];

/** Lo que devuelve un guardado: la lista más el contenido, para no dejar hueco en la caché. */
export type PageMutationResult = FunctionReturnType<typeof api.pages.update>;

export type PageListItemTransport = PageListItem;
export type PageDetailTransport = PageDetail;
export type LinkedTaskTransport = LinkedTask;
export type PageMutationResultTransport = PageMutationResult;
