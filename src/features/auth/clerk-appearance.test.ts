/*
 * Criterio: en las puertas el formulario de Clerk se asienta en el papel (sin
 * card ni la cabecera que repetiría el h1), todo lo que se toca mide los 48 px
 * de la casa con un estilo que gana a Clerk, y el español de Clerk trata de tú.
 */
import { describe, expect, it } from "vitest";
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

/** Una clase de Tailwind pierde contra la regla de Clerk; sólo un estilo con alto llega a 48 px. */
function alto(estilo: unknown): string | undefined {
  if (typeof estilo !== "object" || estilo === null) return undefined;
  const e = estilo as Estilo;
  return (e.height ?? e.minHeight) as string | undefined;
}

describe("clerkPuertaAppearance", () => {
  it("quita la caja, su sombra y la cabecera de Clerk", () => {
    const elementos = clerkPuertaAppearance.elements as Record<string, Estilo>;

    expect(elementos.cardBox).toMatchObject({ boxShadow: "none", background: "transparent" });
    expect(elementos.header).toEqual({ display: "none" });
  });

  it.each([
    ["las puertas", clerkPuertaAppearance],
    ["la cuenta de Ajustes", clerkAppearance],
  ])("en %s cada control tocable lleva el alto de la casa como estilo", (_, apariencia) => {
    const elementos = apariencia.elements as Record<string, unknown>;

    for (const nombre of TOCABLES) {
      expect({ nombre, alto: alto(elementos[nombre]) }).toEqual({ nombre, alto: "2.85rem" });
    }
    // El tope de Clerk (`max-height: 2.25rem`) es lo que dejaba el campo en 38 px.
    expect(elementos.formFieldInput).toMatchObject({ maxHeight: "none" });
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
});

describe("clerkLocalization", () => {
  it("habla de tú donde el paquete dice usted", () => {
    expect(clerkLocalization.signIn?.start?.actionLink).toBe("Crea una");
    expect(clerkLocalization.signUp?.start?.actionText).toBe("¿Ya tienes cuenta?");
    expect(clerkLocalization.formFieldInputPlaceholder__emailAddress).not.toMatch(/Ingrese/);
  });
});
