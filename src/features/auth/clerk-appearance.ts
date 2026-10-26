import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;
type Localization = NonNullable<ComponentProps<typeof ClerkProvider>["localization"]>;

/**
 * El objetivo táctil de la casa (48 px). Va en objetos de estilo y no en
 * clases: Clerk pone `max-height: 2.25rem` a sus campos, y una utilidad de
 * Tailwind pierde contra su regla, así que el campo quedaba en 38 px.
 */
const OBJETIVO = "2.85rem";

/** Lo que se toca en un formulario de Clerk: alto de la casa en los dos temas. */
const tocables = {
  // Sin la sombra que Clerk le pone al primario: en Diario las páginas no
  // tienen elevación, y su regla sólo cede con el mismo selector.
  formButtonPrimary: {
    height: OBJETIVO,
    maxHeight: "none",
    // Ese selector (0,3,0) también gana al anillo de foco de Clerk (0,2,0), así
    // que el anillo se repone aquí en vez de quedar sin foco visible.
    '&[data-variant="solid"][data-color="primary"]': {
      boxShadow: "none",
      "&:focus-visible": { boxShadow: "0 0 0 2px var(--sf), 0 0 0 4px var(--ink)" },
    },
  },
  formFieldInput: { height: OBJETIVO, maxHeight: "none" },
  otpCodeFieldInput: { height: OBJETIVO, maxHeight: "none" },
  socialButtonsBlockButton: { height: OBJETIVO, maxHeight: "none" },
  // El enlace del pie ("Crea una", "Entra") y el ojo de la contraseña eran de
  // 19 y 32 px: un renglón de texto, no un objetivo.
  footerActionLink: { display: "inline-flex", alignItems: "center", minHeight: OBJETIVO, paddingInline: "0.25rem" },
  formFieldInputShowPasswordButton: { minHeight: OBJETIVO, minWidth: OBJETIVO, maxHeight: "none" },
} as const;

/**
 * El enlace del pie ("Crea una", "Entra") es navegación entre dos puertas, no
 * la acción primaria: va en tinta y subrayado, como "Cómo conectar tu agente".
 * El ámbar queda sólo para Continuar. El subrayado se aclara al pasar encima en
 * vez de desaparecer, porque Clerk lo quita en `:hover`.
 */
const enlaceDelPie = {
  ...tocables.footerActionLink,
  fontWeight: 600,
  color: "var(--ink)",
  textDecorationLine: "underline",
  textDecorationColor: "var(--ln2)",
  textUnderlineOffset: "0.15em",
  "&:hover": { color: "var(--ink)", textDecorationLine: "underline", textDecorationColor: "var(--ink)" },
} as const;

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
    ...tocables,
    cardBox: "shadow-none border border-border rounded-xl",
    card: "shadow-none",
    formButtonPrimary: { ...tocables.formButtonPrimary, fontWeight: 600, borderRadius: "9999px" },
    formFieldInput: { ...tocables.formFieldInput, borderRadius: "9999px" },
    formFieldLabel: "font-semibold text-foreground",
    footerAction: { color: "var(--mute)", alignItems: "center" },
    footerActionLink: enlaceDelPie,
    socialButtonsBlockButton: { ...tocables.socialButtonsBlockButton, borderRadius: "9999px" },
    // La cuenta de Ajustes: "Añadir correo", "Cambiar contraseña" y el menú de
    // tres puntos de cada fila eran texto atenuado de 32 px.
    profileSectionPrimaryButton: { minHeight: OBJETIVO, color: "var(--ink)" },
    menuButton: { minHeight: OBJETIVO, minWidth: OBJETIVO, color: "var(--ink)" },
  },
};

/**
 * Lo que cambia en las puertas (entrar y crear cuenta): sin card. En Diario
 * nada es una caja, así que el formulario se asienta en el papel, debajo del
 * título y la frase de la página, y el título de Clerk se calla porque el h1
 * ya lo dice. La cabecera sigue: en el paso del código y en el de la
 * contraseña lleva el correo con su botón de editar y la frase del paso. El pie pierde su banda de color y queda como una línea más.
 * Se aplica en el componente, no en el proveedor: la cuenta de Ajustes sigue
 * con su superficie.
 */
export const clerkPuertaAppearance: Appearance = {
  // Objetos de estilo y no clases: las reglas propias de Clerk ganan a una
  // utilidad de Tailwind en la caja, en el pie y en el alto de los campos.
  elements: {
    ...tocables,
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "none", boxShadow: "none", border: "0", borderRadius: "0", background: "transparent" },
    card: { width: "100%", boxShadow: "none", border: "0", borderRadius: "0", background: "transparent", padding: "0.125rem" },
    headerTitle: { display: "none" },
    footer: { background: "none", boxShadow: "none", border: "0", paddingTop: "0.5rem" },
    // El enlace mide 48 px y la frase un renglón: centrados, no a la base.
    footerAction: { padding: "0.75rem 0", alignItems: "center" },
    formButtonPrimary: { ...tocables.formButtonPrimary, fontWeight: 600, borderRadius: "9999px" },
    formFieldInput: { ...tocables.formFieldInput, borderRadius: "9999px" },
    footerActionLink: enlaceDelPie,
    // Clerk dibuja el borde de los botones sociales con una sombra en
    // `[data-variant="outline"]`, que gana a un `boxShadow` suelto: aquí el
    // anillo pasa a un hairline de verdad y el texto, de tinta al 62%, a tinta.
    socialButtonsBlockButton: {
      ...tocables.socialButtonsBlockButton,
      borderRadius: "9999px",
      background: "transparent",
      color: "var(--ink)",
      '&[data-variant="outline"]': { boxShadow: "none", border: "1px solid var(--ln2)" },
    },
    socialButtonsBlockButtonText: { color: "var(--ink)", fontWeight: 600 },
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
