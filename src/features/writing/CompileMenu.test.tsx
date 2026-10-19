/**
 * Criterio: en el teléfono compilar es una hoja con nombre y tres filas de
 * 48 px. Mientras no hay manuscrito las filas que lo necesitan no se dejan
 * tocar (aria-disabled) y lo dicen («Preparando»); con el manuscrito, tocar un
 * formato descarga el archivo y la hoja se cierra sola al terminar.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderMobile } from "@/shared/testing/render";
import { CompileMenu } from "./CompileMenu";
import type { Manuscript } from "./writing.manuscript";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());
vi.mock("@/shared/utils/download", () => ({
  downloadBlob: vi.fn(),
  slugify: (s: string) => s.toLowerCase().replace(/\s+/g, "-"),
}));

const obra: Manuscript = {
  folderId: "obra-1" as never,
  systemId: "sys-1" as never,
  title: "La marea baja",
  author: "Elias",
  medium: "novel",
  totalWords: 2,
  chapters: [{ id: "c1" as never, title: "La niebla", content: "<p>Uno dos.</p>", wordCount: 2, completed: false }],
};

afterEach(() => {
  window.innerWidth = 1024;
});

describe("CompileMenu en el teléfono", () => {
  it("sin manuscrito las filas no se tocan y lo dicen", async () => {
    renderMobile(<CompileMenu folderId="obra-1" systemId="sys-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Compilar" }));
    expect(await screen.findByRole("heading", { name: "Compilar la obra" })).toBeVisible();
    const markdown = screen.getByRole("button", { name: /Markdown/ });
    expect(markdown).toHaveAttribute("aria-disabled", "true");
    expect(markdown).toHaveTextContent("Preparando");
    expect(screen.getByRole("button", { name: /Word/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("con el manuscrito descarga el formato y cierra la hoja", async () => {
    const { downloadBlob } = await import("@/shared/utils/download");
    renderMobile(<CompileMenu folderId="obra-1" systemId="sys-1" manuscript={obra} />);
    await userEvent.click(screen.getByRole("button", { name: "Compilar" }));
    const markdown = await screen.findByRole("button", { name: /Markdown/ });
    expect(markdown).not.toHaveAttribute("aria-disabled");
    await userEvent.click(markdown);
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "la-marea-baja.md"));
    await waitFor(() => expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("data-state", "closed"));
  });
});
