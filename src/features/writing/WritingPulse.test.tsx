/**
 * Criterio: el consejo de la ventana creativa habla como la casa. Tutea sin
 * voseo, dice la ventana con palabras («de 09 a 11 h») y sin rayas, y cuando
 * no hay datos lo dice en vez de inventar una hora. La meta diaria se toca a
 * 48 px y su barra crece en transform, nunca en ancho.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { WritingPulse, advisorText, formatWindow } from "./WritingPulse";
import type { WritingOverview } from "./writing.types";

const base: WritingOverview = {
  streakDays: 4,
  streakIncludesToday: true,
  wordsToday: 250,
  dailyWordGoal: 500,
  peakWindow: { start: 9, end: 11 },
  currentHour: 10,
  works: [],
};

describe("advisorText", () => {
  it("dice la ventana con palabras y sin raya", () => {
    expect(formatWindow({ start: 9, end: 11 })).toBe("de 09 a 11 h");
    expect(advisorText(base)).toBe("Tu ventana creativa es ahora, de 09 a 11 h. Es el momento de escribir.");
  });

  it("sin curva aprendida dice qué le falta", () => {
    expect(advisorText({ ...base, peakWindow: null })).toMatch(/todavía no tiene datos suficientes/);
  });
});

describe("WritingPulse", () => {
  it("sin datos todavía tutea, sin voseo", () => {
    renderWithProviders(<WritingPulse systemId="s1" />);
    expect(screen.getByText("Escribe en tu mejor ventana creativa: tu pico de energía.")).toBeVisible();
  });

  it("la meta se toca entera y su barra crece en transform", async () => {
    const convex = makeTestConvexClient([stubQuery(api.writing.overview, base as never)]);
    renderWithProviders(<WritingPulse systemId="s1" />, { convex });
    const meta = await screen.findByRole("button", { name: /250 de 500 hoy/ });
    expect(meta).toHaveClass("h-[2.85rem]");
    const barra = meta.querySelector<HTMLElement>("span.origin-left");
    expect(barra?.style.transform).toBe("scaleX(0.5)");
    expect(barra?.style.width).toBe("");
  });
});
