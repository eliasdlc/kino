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
    // Clerk saca sus trazos con transparencia a partir de este color, así que
    // pide uno opaco: con `--ln2`, que ya es tinta al 16%, el borde de un campo
    // quedaba en menos del 2% y el formulario no se veía.
    colorBorder: "var(--ink)",
    colorInput: "var(--sf)",
    colorInputForeground: "var(--ink)",
    colorDanger: "var(--danger)",
    colorSuccess: "var(--ok)",
    colorWarning: "var(--warn)",
    // La escala de la casa: 1.125rem en superficie y campos pill.
    borderRadius: "1.125rem",
    fontFamily: "var(--font-sans), sans-serif",
    fontFamilyButtons: "var(--font-sans), sans-serif",
  },
  elements: {
    cardBox: "shadow-none border border-border rounded-xl",
    card: "shadow-none",
    formButtonPrimary: "font-semibold rounded-full h-[2.85rem]",
    formFieldInput: "rounded-full h-[2.85rem]",
    formFieldLabel: "font-semibold text-foreground",
    footerAction: "text-muted-foreground",
    footerActionLink: "font-semibold text-primary",
    socialButtonsBlockButton: "rounded-full h-[2.85rem]",
    otpCodeFieldInput: "h-[2.85rem]",
  },
};

/**
 * Lo que cambia en las puertas (entrar y crear cuenta): sin card. En Diario
 * nada es una caja, así que el formulario se asienta en el papel, debajo del
 * título y la frase de la página, y la cabecera de Clerk se calla porque el
 * h1 ya lo dice. El pie pierde su banda de color y queda como una línea más.
 * Se aplica en el componente, no en el proveedor: la cuenta de Ajustes sigue
 * con su superficie.
 */
export const clerkPuertaAppearance: Appearance = {
  // Objetos de estilo y no clases: las reglas propias de Clerk ganan a una
  // utilidad de Tailwind en la caja y en el pie, y aquí hay que quitarlas.
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "none", boxShadow: "none", border: "0", borderRadius: "0", background: "transparent" },
    card: { width: "100%", boxShadow: "none", border: "0", borderRadius: "0", background: "transparent", padding: "0.125rem" },
    header: { display: "none" },
    footer: { background: "none", boxShadow: "none", border: "0", paddingTop: "0.5rem" },
    footerAction: { padding: "0.75rem 0" },
    socialButtonsBlockButton: { background: "transparent", boxShadow: "none" },
  },
};

/**
 * El español de Clerk, con lo que a su paquete le falta y en tú, como el
 * resto de la app: el paquete trae "Regístrese" e "Ingrese su".
 */
export const clerkLocalization: Localization = {
  ...esES,
  formFieldInputPlaceholder__signUpPassword: "Crea una contraseña",
  formFieldInputPlaceholder__emailAddress: "tu@correo.com",
  formFieldInputPlaceholder__password: "Tu contraseña",
  formFieldInputPlaceholder__firstName: "Tu nombre",
  formFieldInputPlaceholder__lastName: "Tu apellido",
  signIn: {
    ...esES.signIn,
    start: { ...esES.signIn?.start, actionText: "¿No tienes cuenta?", actionLink: "Crea una" },
  },
  signUp: {
    ...esES.signUp,
    start: { ...esES.signUp?.start, actionText: "¿Ya tienes cuenta?", actionLink: "Entra" },
  },
};
