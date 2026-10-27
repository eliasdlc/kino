/**
 * Criterio: el coach que se monta en Hoy se toca con el pulgar y se lee sin
 * acercarse. Las tres vistas son botones de 48 px con `aria-pressed` (no un
 * patrón de pestañas incompleto), los botones de fila no sobresalen del
 * panel con scroll, ningún texto va en píxeles fijos, y nada gira: lo que
 * está en curso se dice con una palabra.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { CoachPanel } from "./CoachPanel";

type Sugerencias = Parameters<typeof stubQuery<typeof api.insights.suggest>>[1];

const SUGERENCIAS = [
  { id: "k17t0000000000000000000000000001", title: "Repasar el capítulo 4", why: "vence mañana", status: "inbox" },
] as unknown as Sugerencias;

describe("CoachPanel", () => {
  it("vistas y botones de 48 px, texto en rem y ningún spinner", () => {
    const { container } = renderMobile(<CoachPanel />, {
      convex: makeTestConvexClient([stubQuery(api.insights.suggest, SUGERENCIAS)]),
    });

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    const grupo = screen.getByRole("group", { name: "Qué mirar del coach" });
    const vistas = Array.from(grupo.querySelectorAll("button"));
    expect(vistas.map((p) => p.textContent)).toEqual(["Sugerencia", "Energía", "Sistemas"]);
    for (const vista of vistas) expect(vista).toHaveClass("min-h-[2.85rem]");
    expect(vistas[0]).toHaveAttribute("aria-pressed", "true");
    expect(vistas[1]).toHaveAttribute("aria-pressed", "false");

    const hacer = screen.getByRole("button", { name: "Hacer ahora" });
    expect(hacer).toHaveClass("h-[2.85rem]");
    expect(hacer.className).not.toMatch(/\bh-6\b|-mr-/);

    expect(container.innerHTML).not.toMatch(/text-\[10px\]|animate-spin/);
  });

  it("elegir otra vista la marca como pulsada y suelta la anterior", async () => {
    renderMobile(<CoachPanel />, {
      convex: makeTestConvexClient([stubQuery(api.insights.suggest, SUGERENCIAS)]),
    });

    await userEvent.click(screen.getByRole("button", { name: "Sistemas" }));
    expect(screen.getByRole("button", { name: "Sistemas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sugerencia" })).toHaveAttribute("aria-pressed", "false");
  });
});
