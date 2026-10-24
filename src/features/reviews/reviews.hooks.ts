"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { PageReviewView } from "./reviews.types";

/**
 * La revisión de una página. Es una sola suscripción: el panel, el resaltado
 * del editor y el contador del botón la comparten porque piden lo mismo con los
 * mismos argumentos.
 */
export function usePageReview(pageId: string, initialData?: PageReviewView) {
  return useConvexQuery(api.reviews.byPage, { pageId }, { enabled: !!pageId, initialData });
}

export function useResolveComment() {
  return useConvexMutation(api.reviews.resolve);
}

export function useDismissComment() {
  return useConvexMutation(api.reviews.dismiss);
}

export function useReopenComment() {
  return useConvexMutation(api.reviews.reopen);
}

export function useReplyToComment() {
  return useConvexMutation(api.reviews.reply);
}

export function useAskAboutText(pageId: string) {
  return useConvexMutation(api.reviews.ask, {
    map: (data: { quote: string; prefix?: string; suffix?: string; body: string }) => ({ ...data, pageId }),
  });
}
