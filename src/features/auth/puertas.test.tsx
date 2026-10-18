/**
 * Criterio: entrar y crear cuenta pintan su h1 y su frase desde el primer
 * HTML. `useSearchParams` obliga a un `fallback` de `Suspense`, y si ese
 * fallback era sólo el esqueleto del formulario, la página salía sin título y
 * el formulario bajaba al hidratar.
 */
import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderMobile } from "@/shared/testing/render";
import LoginRoute from "@/app/(auth)/login/[[...rest]]/page";
import RegisterRoute from "@/app/(auth)/register/[[...rest]]/page";

/** Lo que el servidor emite antes de que el cliente lea la URL. */
function fallbackDe(ruta: () => ReactElement): ReactElement {
  return (ruta() as ReactElement<{ fallback: ReactElement }>).props.fallback;
}

describe("las puertas antes de hidratar", () => {
  it("entrar trae el título y la frase", () => {
    renderMobile(fallbackDe(LoginRoute));

    expect(screen.getByRole("heading", { level: 1, name: "Entra a tu día" })).toBeInTheDocument();
    expect(screen.getByText(/Tu energía de hoy/)).toBeInTheDocument();
  });

  it("crear cuenta trae el título y la frase", () => {
    renderMobile(fallbackDe(RegisterRoute));

    expect(screen.getByRole("heading", { level: 1, name: "Crea tu cuenta" })).toBeInTheDocument();
    expect(screen.getByText(/una sola pregunta/)).toBeInTheDocument();
  });
});
