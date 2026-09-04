import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;

/**
 * Las pantallas de Clerk leen los mismos tokens de shadcn que el resto de la
 * app (`--background`, `--primary`, `--radius`…), así que cambiar el tema de
 * Kino las cambia a ellas. Lo que no sale de un token va aquí.
 */
export const clerkAppearance: Appearance = {
  theme: shadcn,
  elements: {
    cardBox: "shadow-none border border-border",
    formButtonPrimary: "font-medium",
    footerAction: "text-muted-foreground",
  },
};
