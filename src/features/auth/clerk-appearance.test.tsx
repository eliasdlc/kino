/*
 * Criterio: en las puertas el formulario de Clerk se asienta en el papel (sin
 * card ni la cabecera que repetiría el h1), todo lo que se toca mide los 48 px
 * de la casa, el enlace del pie va en tinta subrayada (el ámbar es sólo de
 * Continuar) y el español de Clerk trata de tú. Lo tocable se lee del efecto:
 * cada estilo pasa por la emoción de Clerk, la misma que viste sus elementos, y
 * se mide el estilo calculado del elemento que la recibe, no el objeto.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/shared/testing/render";
import { clerkAppearance, clerkLocalization, clerkPuertaAppearance } from "./clerk-appearance";

type Estilo = Record<string, unknown>;

/** Lo que se toca en entrar y crear cuenta: los campos, los botones, el enlace del pie y el ojo. */
const TOCABLES = [
  "formFieldInput",
  "formButtonPrimary",
  "socialButtonsBlockButton",
  "footerActionLink",
  "formFieldInputShowPasswordButton",
  "otpCodeFieldInput",
];

// La emoción con la que Clerk convierte cada entrada de `elements` en una clase:
// la de su propio paquete, no una copia.
const desdeClerk = createRequire(createRequire(import.meta.url).resolve("@clerk/ui/package.json"));
const { jsx } = desdeClerk("@emotion/react") as {
  jsx: (tipo: string, props: Record<string, unknown>, ...hijos: string[]) => React.ReactElement;
};

/**
 * El elemento de Clerk tal como lo pinta: su clase `cl-` y el estilo de la
 * apariencia aplicado por emoción. Devuelve el estilo calculado. Si Clerk cambia
 * cómo aplica `elements`, esto sólo lo ve la captura de la puerta.
 */
function pintado(apariencia: { elements?: unknown }, nombre: string): CSSStyleDeclaration {
  const estilo = (apariencia.elements as Record<string, unknown>)[nombre];
  const { container } = renderWithProviders(jsx("a", { className: `cl-${nombre}`, css: [estilo], href: "#" }, nombre));
  return getComputedStyle(container.querySelector(`.cl-${nombre}`)!);
}

/** El CSS que emoción inyecta para el estilo de un elemento, tal como llega al documento. */
function reglasDe(apariencia: { elements?: unknown }, nombre: string): string {
  pintado(apariencia, nombre);
  return [...document.querySelectorAll("style")].map((hoja) => hoja.textContent ?? "").join("").replace(/\s+/g, "");
}

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("clerkPuertaAppearance", () => {
  it("quita la caja y su sombra, y calla el título y su frase", () => {
    const elementos = clerkPuertaAppearance.elements as Record<string, Estilo>;

    expect(elementos.cardBox).toMatchObject({ boxShadow: "none", background: "transparent" });
    // La frase ("para continuar a Kino") sola era un fragmento en minúscula bajo
    // el h1 y la voz de la página.
    for (const nombre of ["headerTitle", "headerSubtitle"]) {
      expect({ nombre, display: pintado(clerkPuertaAppearance, nombre).display }).toEqual({ nombre, display: "none" });
    }
  });

  it("no calla lo que da salida en el paso del correo, de la contraseña y del código", () => {
    // La cabecera lleva el correo con su botón de editar y el enlace de volver;
    // el campo, el de "¿Olvidaste tu contraseña?" o "Reenviar": ocultarlos deja
    // sin salida a quien se equivocó.
    for (const nombre of ["header", "identityPreview", "identityPreviewEditButton", "headerBackLink", "formFieldAction"]) {
      expect({ nombre, display: pintado(clerkPuertaAppearance, nombre).display }).not.toEqual({ nombre, display: "none" });
    }
  });

  it.each([
    ["las puertas", clerkPuertaAppearance],
    ["la cuenta de Ajustes", clerkAppearance],
  ])("en %s cada control tocable sale pintado con el alto de la casa", (_, apariencia) => {
    for (const nombre of TOCABLES) {
      const calculado = pintado(apariencia, nombre);
      const alto = calculado.height && calculado.height !== "auto" ? calculado.height : calculado.minHeight;
      expect({ nombre, alto }).toEqual({ nombre, alto: "2.85rem" });
    }
    // El tope de Clerk (`max-height: 2.25rem`) es lo que dejaba el campo en 38 px.
    expect(pintado(apariencia, "formFieldInput").maxHeight).toBe("none");
  });

  it.each([
    ["las puertas", clerkPuertaAppearance],
    ["la cuenta de Ajustes", clerkAppearance],
  ])("en %s el enlace del pie sale en tinta y subrayado, no en ámbar", (_, apariencia) => {
    const enlace = pintado(apariencia, "footerActionLink");

    expect(enlace.color).toBe("var(--ink)");
    expect(enlace.textDecorationLine).toBe("underline");
  });

  it("en la cuenta de Ajustes los botones de sección y el menú de cada fila también miden 48 px", () => {
    const elementos = clerkAppearance.elements as Record<string, Estilo>;

    expect(elementos.profileSectionPrimaryButton).toMatchObject({ minHeight: "2.85rem" });
    expect(elementos.menuButton).toMatchObject({ minHeight: "2.85rem", minWidth: "2.85rem" });
  });

  it("los botones sociales pierden la sombra también en la variante que Clerk usa", () => {
    const social = (clerkPuertaAppearance.elements as Record<string, Estilo>).socialButtonsBlockButton;

    // Sin sombra, el borde pasa a ser un hairline de verdad en la misma regla.
    expect(social?.['&[data-variant="outline"]']).toEqual({ boxShadow: "none", border: "1px solid var(--ln2)" });
  });

  it.each([
    ["las puertas", clerkPuertaAppearance],
    ["la cuenta de Ajustes", clerkAppearance],
  ])("en %s el primario no lleva sombra en ningún estado y conserva un anillo al enfocar con teclado", (_, apariencia) => {
    const css = reglasDe(apariencia, "formButtonPrimary");
    const primario = escapar('[data-variant="solid"][data-color="primary"]');
    // Cada estado es una regla propia: las de Clerk para `:focus` (0,4,0) y
    // `:focus:not(:focus-visible)` (0,5,0) ganan a la de reposo (0,3,0) y traen
    // la sombra de vuelta tras un toque de ratón o de dedo.
    const regla = (estado: string) => css.match(new RegExp(`${primario}${escapar(estado)}\\{([^}]*)\\}`));

    for (const estado of ["", ":focus", ":focus:not(:focus-visible)"]) {
      expect({ estado, regla: regla(estado)?.[1] }).toEqual({ estado, regla: "box-shadow:none;" });
    }
    expect(regla(":focus-visible")?.[1]).toMatch(/^box-shadow:(?!none)[^;]+;$/);
    // `:focus-visible` pesa lo mismo que `:focus`: va después para que el anillo gane.
    expect(css.indexOf(`${'[data-variant="solid"][data-color="primary"]'}:focus-visible{`)).toBeGreaterThan(
      css.indexOf(`${'[data-variant="solid"][data-color="primary"]'}:focus:not(:focus-visible){`),
    );
  });
});

describe("clerkLocalization", () => {
  it("habla de tú donde el paquete dice usted", () => {
    expect(clerkLocalization.signIn?.start?.actionLink).toBe("Crea una");
    expect(clerkLocalization.signUp?.start?.actionText).toBe("¿Ya tienes cuenta?");
    expect(clerkLocalization.formFieldInputPlaceholder__emailAddress).not.toMatch(/Ingrese/);
  });
});
