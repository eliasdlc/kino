/**
 * Criterio: "Tu patrón" se lee como renglones de Diario. El ciclo del día es
 * una línea bajo hairline y no una caja, el pico va en tinta y no en el
 * acento, ningún texto lleva punto medio, y el sujeto es la previsión o la
 * persona, nunca el producto en primera persona.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { mockLearningInsight } from "@/app/system-design/mock-data";
import type { VerificationLoop } from "@/features/energy/energy.prediction";
import { LearningInsightCard } from "./LearningInsightCard";

const LOOP = {
  slot: "morning",
  verdict: "close",
  predictedLevel: 60,
  reportedLevel: 72,
  delta: 12,
  improvementPct: 4,
  alphaAfterPct: 41,
  fromLearnedCurve: false,
} as unknown as VerificationLoop;

describe("LearningInsightCard", () => {
  it("el ciclo es una línea sin caja, con lo previsto y lo registrado", () => {
    const { container } = renderWithProviders(<LearningInsightCard insight={mockLearningInsight({ loop: LOOP })} />);

    const ciclo = container.querySelector("[data-slot=verification-loop]");
    expect(ciclo).not.toBeNull();
    expect(ciclo).toHaveClass("border-t");
    expect(ciclo?.className).not.toMatch(/rounded|bg-/);
    expect(ciclo).toHaveTextContent("Cerca en la mañana: previsto 60, registraste 72 (+12).");
    expect(ciclo).toHaveTextContent("Con ese dato la previsión mejoró 4 %");
  });

  it("el pico va en tinta y en peso, no en el acento", () => {
    renderWithProviders(<LearningInsightCard insight={mockLearningInsight()} />);

    const pico = screen.getByText("9 AM – 12 PM");
    expect(pico).toHaveClass("text-foreground", "font-semibold");
    expect(pico).not.toHaveClass("text-primary");
  });

  it("ni punto medio ni el producto como sujeto en primera persona", () => {
    const { container } = renderWithProviders(<LearningInsightCard insight={mockLearningInsight({ loop: LOOP })} />);

    const texto = container.textContent ?? "";
    expect(texto).not.toContain("·");
    expect(texto).not.toMatch(/\b(Predije|Acerté|Me equivoqué|mi modelo|mejoro)\b/);
    expect(texto).not.toMatch(/\bKino\b/);
  });
});
