import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { DocumentRail } from "./DocumentRail";
import type { OutlineItem } from "./mediums/outline";

/**
 * Criterio: el carril es navegación, no decoración. Una marca por título con el
 * ancho de su nivel, nada cuando el documento no tiene de dónde navegar, y el
 * teclado llega a la misma función de salto que el puntero. Si se pintara con
 * un solo título, o si Enter no saltara, estos tests se ponen rojos.
 */

function heading(pos: number, label: string, depth = 0): OutlineItem {
  return { pos, label, depth, kind: "heading", preview: null };
}

const APUNTE = [
  heading(0, "Análisis léxico"),
  heading(40, "Autómatas finitos", 1),
  heading(90, "AFD contra AFND", 2),
];

function tick(name: string): Element {
  const marca = screen.getByRole("button", { name }).firstElementChild;
  if (!marca) throw new Error(`La marca de "${name}" no tiene barra que pintar`);
  return marca;
}

describe("DocumentRail", () => {
  it("pinta una marca por título, y el ancho dice el nivel", () => {
    renderWithProviders(<DocumentRail items={APUNTE} activePos={null} onJump={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(tick("Análisis léxico")).toHaveClass("w-4");
    expect(tick("Autómatas finitos")).toHaveClass("w-3");
    expect(tick("AFD contra AFND")).toHaveClass("w-2");
  });

  it("no se pinta cuando el documento tiene un solo título", () => {
    renderWithProviders(
      <DocumentRail items={[heading(0, "Análisis léxico")]} activePos={null} onJump={vi.fn()} />,
    );

    expect(screen.queryByTestId("document-rail")).not.toBeInTheDocument();
  });

  it("Enter sobre una marca enfocada salta a la posición de su título", async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DocumentRail items={APUNTE} activePos={null} onJump={onJump} />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Autómatas finitos" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onJump).toHaveBeenCalledExactlyOnceWith(40);
  });

  it("solo la marca de la sección que se lee va marcada como el sitio actual", () => {
    renderWithProviders(<DocumentRail items={APUNTE} activePos={40} onJump={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Autómatas finitos" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getByRole("button", { name: "Análisis léxico" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
