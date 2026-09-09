/**
 * Criterio: la evidencia se pinta como enlace a la fila que la justifica, con
 * el título que el servidor resolvió. Un capítulo enlaza a su propia página;
 * una tarea, al sistema donde vive, que es donde se la encuentra. El sujeto de
 * la frase es el agente del usuario, nunca Kino.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/shared/testing/render";
import { ProposalBody, type Proposal } from "./ProposalBody";

const cancelarTarea: Proposal = {
  kind: "cancel",
  motivo: "Lleva dos meses sin tocarse",
  evidencia: { tipo: "task", id: "tasks:1", titulo: "Marco teórico", systemId: "systems:1" },
};

describe("ProposalBody", () => {
  it("la evidencia es un enlace a donde vive la fila, con su título", () => {
    renderWithProviders(<ProposalBody propuesta={cancelarTarea} />);

    const enlace = screen.getByRole("link", { name: "Marco teórico" });
    expect(enlace).toHaveAttribute("href", "/systems/systems:1");
  });

  it("un capítulo enlaza a su propia página", () => {
    renderWithProviders(
      <ProposalBody
        propuesta={{
          kind: "rewrite",
          motivo: null,
          evidencia: { tipo: "page", id: "pages:1", titulo: "Capítulo 1", systemId: "systems:1" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Capítulo 1" })).toHaveAttribute("href", "/systems/systems:1/pages/pages:1");
  });

  it("el sujeto es tu agente y el motivo va detrás, no en gris pequeño aparte", () => {
    const { container } = renderWithProviders(<ProposalBody propuesta={cancelarTarea} />);

    expect(container.textContent).toBe("Tu agente propone mandar a la papelera Marco teórico: Lleva dos meses sin tocarse");
  });

  it("sin sistema no hay ruta, y el título se pinta igual en vez de un enlace muerto", () => {
    renderWithProviders(
      <ProposalBody
        propuesta={{ ...cancelarTarea, motivo: null, evidencia: { ...cancelarTarea.evidencia, systemId: null } }}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Marco teórico")).toBeVisible();
  });

  it("un capítulo sin título se nombra sin fingir que lo tiene", () => {
    renderWithProviders(
      <ProposalBody
        propuesta={{
          kind: "rewrite",
          motivo: null,
          evidencia: { tipo: "page", id: "pages:1", titulo: null, systemId: "systems:1" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "algo sin título" })).toBeVisible();
  });
});
