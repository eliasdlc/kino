/**
 * Criterio: el catálogo monta entero sin servidor. Cada sección del índice
 * existe en la página con su ancla, así que borrar una sección o romper su
 * specimen deja de compilar o deja de pasar aquí, y `/system-design` no vuelve
 * a desaparecer sin que nadie lo note, como pasó en la migración a Convex.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { SystemDesignShell } from "./SystemDesignShell";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

describe("SystemDesignShell", () => {
  it("monta las secciones del catálogo con sus anclas", () => {
    renderWithProviders(<SystemDesignShell />);
    const anchors = screen.getAllByRole("link").filter((a) => /^#.+/.test(a.getAttribute("href") ?? ""));
    expect(anchors.length).toBeGreaterThanOrEqual(14);
    const missing = anchors.map((a) => a.getAttribute("href")!.slice(1)).filter((id) => !document.getElementById(id));
    expect(missing).toEqual([]);
  });
});
