import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** Lo que pinta el panel de una página: pasadas, barra y comentarios. */
export type PageReviewView = FunctionReturnType<typeof api.reviews.byPage>;
export type ReviewComment = PageReviewView["comments"][number];
export type ReviewPass = PageReviewView["reviews"][number];
export type ReviewProgress = PageReviewView["progress"];

export type ReviewCategory = NonNullable<ReviewComment["category"]>;
export type ReviewSeverity = NonNullable<ReviewComment["severity"]>;

/**
 * Dónde está un comentario en el texto que el editor tiene delante ahora, que
 * no es el guardado: `here` sigue diciendo lo que citó, `edited` es un
 * fragmento que la persona reescribió, `missing` uno que ya no está.
 */
export type AnchorState = "here" | "edited" | "missing";
