/**
 * Criterio: cada sistema del sidebar se nombra a sí mismo. El chevron dice si
 * está desplegado y de qué sistema habla, desplegarlo enseña sus carpetas, y
 * el botón de opciones y la versión plegada del sidebar llevan el nombre del
 * sistema, no un "Opciones" que en una lista de diez no distingue nada.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { makeFolder, makeSystem, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSystemsTreeStore } from "./systems.store";
import { SystemTreeItem } from "./SystemTreeItem";

vi.mock("next/navigation", async () => (await import("@/shared/testing/navigation")).navigationMock());

const NOVELA = makeSystem({ id: mid("sys-novela"), name: "La casa de las cotas", templateType: "writing", icon: "feather" });

function conObras() {
  return makeTestConvexClient([
    stubQuery(api.folders.bySystem, [makeFolder({ id: mid("obra-1"), name: "Primera parte", systemId: NOVELA.id })]),
  ]);
}

describe("SystemTreeItem", () => {
  beforeEach(() => {
    useSystemsTreeStore.setState({ expanded: {}, pinnedIds: [] });
  });

  it("el chevron dice su estado con el nombre del sistema, y desplegar enseña sus carpetas", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TooltipProvider>
        <SystemTreeItem system={NOVELA} isActive={false} />
      </TooltipProvider>,
      { convex: conObras() },
    );

    const chevron = screen.getByRole("button", { name: "Expandir La casa de las cotas" });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Primera parte" })).not.toBeInTheDocument();

    await user.click(chevron);

    expect(screen.getByRole("button", { name: "Contraer La casa de las cotas" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Primera parte" })).toHaveAttribute(
      "href",
      `/systems/${NOVELA.id}/folders/${mid("obra-1")}`,
    );
  });

  it("las opciones llevan el nombre del sistema y el enlace lleva a su página", () => {
    renderWithProviders(
      <TooltipProvider>
        <SystemTreeItem system={NOVELA} isActive />
      </TooltipProvider>,
      { convex: conObras() },
    );

    expect(screen.getByRole("button", { name: "Opciones de La casa de las cotas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "La casa de las cotas" })).toHaveAttribute("href", `/systems/${NOVELA.id}`);
  });

  it("plegado, el sidebar es un icono: el enlace se nombra con el sistema", () => {
    renderWithProviders(
      <TooltipProvider>
        <SystemTreeItem system={NOVELA} isActive={false} collapsed />
      </TooltipProvider>,
      { convex: conObras() },
    );

    expect(screen.getByRole("link", { name: "La casa de las cotas" })).toHaveAttribute("href", `/systems/${NOVELA.id}`);
    expect(screen.queryByRole("button", { name: /Expandir/ })).not.toBeInTheDocument();
  });
});
