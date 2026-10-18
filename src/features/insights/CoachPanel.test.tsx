/**
 * Criterio: el coach que se monta en Hoy se toca con el pulgar y se lee sin
 * acercarse. Las pestañas y los botones miden el táctil de 48 px, ningún
 * texto va en píxeles fijos, y nada gira: lo que está en curso se dice con
 * una palabra.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { CoachPanel } from "./CoachPanel";

type Sugerencias = Parameters<typeof stubQuery<typeof api.insights.suggest>>[1];

const SUGERENCIAS = [
  { id: "k17t0000000000000000000000000001", title: "Repasar el capítulo 4", why: "vence mañana", status: "inbox" },
] as unknown as Sugerencias;

describe("CoachPanel", () => {
  it("pestañas y botones de 48 px, texto en rem y ningún spinner", () => {
    const { container } = renderMobile(<CoachPanel />, {
      convex: makeTestConvexClient([stubQuery(api.insights.suggest, SUGERENCIAS)]),
    });

    const pestanas = screen.getAllByRole("tab");
    expect(pestanas.map((p) => p.textContent)).toEqual(["Sugerencia", "Energía", "Sistemas"]);
    for (const pestana of pestanas) expect(pestana).toHaveClass("min-h-[2.85rem]");
    expect(pestanas[0]).toHaveAttribute("aria-selected", "true");

    const hacer = screen.getByRole("button", { name: "Hacer ahora" });
    expect(hacer).toHaveClass("h-[2.85rem]");
    expect(hacer.className).not.toMatch(/\bh-6\b/);

    expect(container.innerHTML).not.toMatch(/text-\[10px\]|animate-spin/);
  });
});
