/**
 * Criterio: la lectura es una pantalla de Diario con estados reales. El título
 * de la obra es el único h1, cada capítulo abre con su numeral y su título, el
 * modo de leer es un segmento (Paginado o Continuo) con una opción siempre
 * elegida, y una obra sin texto lo dice con un estado vacío y no con una caja.
 * El papel es un interruptor con nombre visible que dice su estado, e imprimir
 * se lee con su palabra.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/shared/testing/render";
import { ReadingView } from "./ReadingView";
import type { Manuscript } from "./writing.manuscript";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const obra: Manuscript = {
  folderId: "obra-1" as never,
  systemId: "sys-1" as never,
  title: "La marea baja",
  author: "Elias",
  medium: "novel",
  totalWords: 1240,
  chapters: [
    { id: "c1" as never, title: "La niebla", content: "<p>Uno.</p>", wordCount: 600, completed: true },
    { id: "c2" as never, title: "", content: "<p>Dos.</p>", wordCount: 640, completed: false },
  ],
};

describe("ReadingView", () => {
  it("un solo h1, la meta con comas y cada capítulo con su numeral", () => {
    renderWithProviders(<ReadingView manuscript={obra} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("La marea baja");
    expect(screen.getByText(/^Novela, 2 capítulos, 1\.?240 palabras$/)).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: /^Capítulo 2:\s*Sin título$/ })).toBeInTheDocument();
  });

  it("el modo de leer es un segmento con una opción siempre elegida", async () => {
    renderWithProviders(<ReadingView manuscript={obra} />);
    const paginado = screen.getByRole("radio", { name: "Paginado" });
    const continuo = screen.getByRole("radio", { name: "Continuo" });
    expect(paginado).toHaveAttribute("data-on");
    await userEvent.click(continuo);
    expect(continuo).toHaveAttribute("data-on");
    expect(screen.queryByRole("button", { name: "Página siguiente" })).not.toBeInTheDocument();
  });

  it("una obra sin texto lo dice con un estado vacío", () => {
    renderWithProviders(
      <ReadingView manuscript={{ ...obra, chapters: obra.chapters.map((c) => ({ ...c, content: "" })) }} />,
    );
    expect(screen.getByRole("heading", { name: "Todavía no hay nada que leer" })).toBeVisible();
  });

  it("el papel es un interruptor con nombre y estado, e imprimir dice su palabra", async () => {
    renderWithProviders(<ReadingView manuscript={obra} />);
    const papel = screen.getByRole("button", { name: "Papel cálido" });
    expect(papel).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(papel);
    expect(papel).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Imprimir/ })).toHaveTextContent("Imprimir");
  });
});
