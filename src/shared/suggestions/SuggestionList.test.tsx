import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckCircle2, PenLine, Sparkles } from "lucide-react";
import { SuggestionList, type SuggestionEmptyState } from "./SuggestionList";
import type { Suggestion } from "./types";

/**
 * Los dos estados vacíos dicen cosas distintas y por eso se prueban por
 * separado: un sistema recién creado no está tranquilo, está sin empezar.
 */

type Demo = Suggestion<"retomar" | "parada">;

const UNSTARTED: SuggestionEmptyState = {
  icon: Sparkles,
  title: "Todavía no hay nada que contar",
  description: "Escribe el primer capítulo y esto se llena solo.",
};

const QUIET: SuggestionEmptyState = {
  icon: CheckCircle2,
  title: "Nada que señalar",
  description: "Ninguna obra parada y ningún capítulo a medias.",
};

const SUGERENCIAS: Demo[] = [
  {
    kind: "retomar",
    title: "Retoma «La niebla»",
    reason: "Es lo último que escribiste, hace 1 día.",
    target: { kind: "page", id: "p1" },
    weight: 90,
  },
  {
    kind: "parada",
    title: "«La marea baja» lleva 5 días sin sesión",
    reason: "Se mide contra sesiones reales.",
    weight: 60,
  },
];

function pintar(props: Partial<Parameters<typeof SuggestionList<Demo>>[0]> = {}) {
  render(
    <SuggestionList<Demo>
      suggestions={SUGERENCIAS}
      quiet={QUIET}
      unstarted={UNSTARTED}
      iconFor={() => PenLine}
      hrefFor={(s) => (s.target ? `/pages/${s.target.id}` : null)}
      {...props}
    />,
  );
}

describe("SuggestionList", () => {
  it("sin datos todavía dice que no hay nada que contar, no que todo está tranquilo", () => {
    pintar({ suggestions: [], isUnstarted: true });
    expect(screen.getByText(UNSTARTED.title)).toBeInTheDocument();
    expect(screen.queryByText(QUIET.title)).not.toBeInTheDocument();
  });

  it("con datos y nada que cruce el umbral dice que no hay nada que señalar", () => {
    pintar({ suggestions: [] });
    expect(screen.getByText(QUIET.title)).toBeInTheDocument();
    expect(screen.queryByText(UNSTARTED.title)).not.toBeInTheDocument();
  });

  it("sin estado de sin empezar declarado, ese caso cae en el tranquilo", () => {
    pintar({ suggestions: [], isUnstarted: true, unstarted: undefined });
    expect(screen.getByText(QUIET.title)).toBeInTheDocument();
  });

  it("cada sugerencia enseña su razón al lado del título", () => {
    pintar();
    for (const sugerencia of SUGERENCIAS) {
      expect(screen.getByText(sugerencia.title)).toBeInTheDocument();
      expect(screen.getByText(sugerencia.reason)).toBeInTheDocument();
    }
  });

  it("la que lleva a algún sitio es un enlace y la que no, no lo es", () => {
    pintar();
    expect(screen.getByRole("link", { name: /Retoma/ })).toHaveAttribute("href", "/pages/p1");
    expect(screen.queryByRole("link", { name: /marea baja/ })).not.toBeInTheDocument();
  });

  it("con sugerencias no pinta ningún estado vacío", () => {
    pintar();
    expect(screen.queryByText(QUIET.title)).not.toBeInTheDocument();
    expect(screen.queryByText(UNSTARTED.title)).not.toBeInTheDocument();
  });
});
