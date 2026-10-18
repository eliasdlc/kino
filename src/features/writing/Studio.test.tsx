/**
 * Criterio: el Estudio se lee como Diario y en castellano también antes de
 * desplegar Convex. Las sugerencias son filas de margen (enlace, sin caja), la
 * razón que un despliegue anterior separaba con punto medio y «en sin obra» se
 * lee bien, y el encabezado no lleva una etiqueta suelta que no dice nada.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { Studio, conRazonLegible } from "./Studio";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const VIEJA = {
  kind: "resume-chapter" as const,
  title: "Retoma «La subida»",
  reason: "Es lo último que escribiste, hace 31 días · 136 palabras en sin obra.",
  target: { kind: "page" as const, id: "cap-1" },
  weight: 70,
};

describe("Studio", () => {
  it("la razón de un despliegue anterior se lee sin punto medio ni «en sin obra»", () => {
    expect(conRazonLegible(VIEJA).reason).toBe(
      "Es lo último que escribiste, hace 31 días; 136 palabras en un manuscrito suelto.",
    );
    const nueva = { ...VIEJA, reason: "Lo tocaste hoy y sigue sin terminar; 12 palabras en La obra." };
    expect(conRazonLegible(nueva)).toBe(nueva);
  });

  it("cada sugerencia es una fila que lleva a su capítulo, con la razón visible y sin «Sin IA» suelto", async () => {
    const convex = makeTestConvexClient([
      stubQuery(api.writing.studio, {
        systemId: "sys-1" as Id<"systems">,
        suggestions: [VIEJA],
        codexGaps: [],
        looseThreadCount: 0,
      }),
    ]);
    renderWithProviders(<Studio systemId="sys-1" />, { convex });

    const fila = await screen.findByRole("link", { name: /Retoma «La subida»/ });
    expect(fila).toHaveAttribute("href", "/systems/sys-1/pages/cap-1");
    expect(fila).toHaveAttribute("data-slot", "margin-row");
    expect(screen.getByText(/136 palabras en un manuscrito suelto/)).toBeVisible();
    expect(screen.queryByText("Sin IA")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qué escribir hoy" })).toBeVisible();
  });
});
