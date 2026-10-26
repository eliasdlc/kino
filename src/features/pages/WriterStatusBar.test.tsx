/**
 * Criterio: la barra de estado del capítulo se lee sin repetirse y dice su
 * progreso con números. Es un grupo con nombre y no una región viva, la barra
 * de la obra es un progressbar con su valor que crece en transform, y «Papel
 * cálido» y «Enfoque» son interruptores con nombre visible y aria-pressed.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { WriterStatusBar } from "./WriterStatusBar";

const obra = { id: "f1", name: "La marea baja", wordGoal: 1000, wordsExcludingCurrent: 400 };

describe("WriterStatusBar", () => {
  it("es un grupo con nombre, no una región viva", () => {
    renderWithProviders(<WriterStatusBar obra={obra} systemId="s1" paper={false} onTogglePaper={() => {}} />);
    expect(screen.getByRole("group", { name: "Estado del capítulo" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("el progreso de la obra dice su valor y crece en transform", () => {
    renderWithProviders(<WriterStatusBar obra={obra} systemId="s1" paper={false} onTogglePaper={() => {}} />);
    const barra = screen.getByRole("progressbar", { name: "Progreso de la obra" });
    expect(barra).toHaveAttribute("aria-valuenow", "40");
    const relleno = barra.querySelector<HTMLElement>('[data-slot="progreso"]');
    expect(relleno?.style.transform).toBe("scaleX(0.4)");
    expect(relleno?.style.width).toBe("");
    expect(relleno).not.toHaveClass("bg-primary");
  });

  it("papel cálido y enfoque son interruptores con su nombre", async () => {
    const onTogglePaper = vi.fn();
    renderWithProviders(
      <WriterStatusBar obra={obra} systemId="s1" paper onTogglePaper={onTogglePaper} onToggleFocus={() => {}} />,
    );
    const papel = screen.getByRole("button", { name: "Papel cálido" });
    expect(papel).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(papel);
    expect(onTogglePaper).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enfoque" })).toHaveAttribute("aria-pressed", "false");
  });
});
