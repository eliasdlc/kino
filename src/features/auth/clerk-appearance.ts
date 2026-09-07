import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;
type Localization = NonNullable<ComponentProps<typeof ClerkProvider>["localization"]>;

/**
 * Las pantallas de Clerk visten la identidad de Kino: el tema de shadcn lee
 * los tokens (`--background`, `--primary`, `--radius`) y las variables de aquí
 * atan lo que ese tema no toma solo, con los roles y las caras del producto.
 * Lo que no sale de una variable va en `elements`.
 */
export const clerkAppearance: Appearance = {
  theme: shadcn,
  variables: {
    colorPrimary: "var(--ac)",
    colorPrimaryForeground: "var(--on)",
    colorBackground: "var(--sf)",
    colorForeground: "var(--ink)",
    colorMutedForeground: "var(--mute)",
    colorBorder: "var(--ln2)",
    colorInput: "var(--sf)",
    colorInputForeground: "var(--ink)",
    colorDanger: "var(--danger)",
    borderRadius: "1rem",
    fontFamily: "var(--font-inter), sans-serif",
  },
  elements: {
    cardBox: "shadow-none border border-border rounded-2xl",
    card: "shadow-none",
    formButtonPrimary: "font-semibold rounded-full h-[2.85rem]",
    formFieldInput: "rounded-lg",
    footerAction: "text-muted-foreground",
    socialButtonsBlockButton: "rounded-full h-[2.85rem]",
  },
};

/** El español de Clerk, con lo que a su paquete le falta. */
export const clerkLocalization: Localization = {
  ...esES,
  formFieldInputPlaceholder__signUpPassword: "Crea una contraseña",
};
