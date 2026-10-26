/**
 * Criterio: las etiquetas de la página se encienden y se apagan como
 * interruptores. Cada una es un botón con aria-pressed, la puesta va en tinta
 * (selección es estado, no ámbar), tocar una apagada la añade a la página, y
 * sin etiquetas en el sistema el bloque no pinta un encabezado sobre nada.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from "@/shared/testing/render";
import { NotebookTagPicker } from "./NotebookTagPicker";

const tags = [
  { id: "t1", title: "Borrador", color: "blue" },
  { id: "t2", title: "Revisar", color: "red" },
];

describe("NotebookTagPicker", () => {
  it("la puesta va en tinta con aria-pressed y la apagada no", async () => {
    const convex = makeTestConvexClient([
      stubQuery(api.tags.bySystem, tags as never),
      stubQuery(api.pages.tags, [tags[0]] as never),
    ]);
    renderWithProviders(<NotebookTagPicker pageId="p1" systemId="s1" />, { convex });
    const puesta = await screen.findByRole("button", { name: "Borrador" });
    expect(puesta).toHaveAttribute("aria-pressed", "true");
    expect(puesta).toHaveClass("bg-foreground");
    expect(puesta).not.toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: "Revisar" })).toHaveAttribute("aria-pressed", "false");
  });

  it("tocar una apagada la añade a la página", async () => {
    const convex = makeTestConvexClient(
      [stubQuery(api.tags.bySystem, tags as never), stubQuery(api.pages.tags, [] as never)],
      [stubMutation(api.pages.addTag, null as never)],
    );
    renderWithProviders(<NotebookTagPicker pageId="p1" systemId="s1" />, { convex });
    await userEvent.click(await screen.findByRole("button", { name: "Revisar" }));
    expect(convex.calls).toContainEqual(expect.objectContaining({ args: { id: "p1", tagId: "t2" } }));
  });

  it("sin etiquetas en el sistema no pinta el bloque", () => {
    const convex = makeTestConvexClient([stubQuery(api.tags.bySystem, [] as never)]);
    renderWithProviders(<NotebookTagPicker pageId="p1" systemId="s1" />, { convex });
    expect(screen.queryByRole("heading", { name: "Etiquetas" })).not.toBeInTheDocument();
  });
});
