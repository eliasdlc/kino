import { describe, expect, it } from "vitest";
import { clerkLocalization, clerkPuertaAppearance } from "./clerk-appearance";

/*
 * Criterio: en las puertas (entrar y crear cuenta) el formulario de Clerk se
 * asienta en el papel, sin card y sin la cabecera que repetiría el h1, y el
 * español de Clerk trata de tú como el resto de la app.
 */

describe("clerkPuertaAppearance", () => {
  it("quita la caja, su sombra y la cabecera de Clerk", () => {
    const elementos = clerkPuertaAppearance.elements as Record<string, Record<string, string>>;

    expect(elementos.cardBox).toMatchObject({ boxShadow: "none", border: "0", background: "transparent" });
    expect(elementos.card).toMatchObject({ boxShadow: "none", background: "transparent" });
    expect(elementos.header).toEqual({ display: "none" });
  });
});

describe("clerkLocalization", () => {
  it("habla de tú donde el paquete dice usted", () => {
    expect(clerkLocalization.signIn?.start?.actionLink).toBe("Crea una");
    expect(clerkLocalization.signUp?.start?.actionText).toBe("¿Ya tienes cuenta?");
    expect(clerkLocalization.formFieldInputPlaceholder__emailAddress).not.toMatch(/Ingrese/);
  });
});
