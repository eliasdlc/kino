/**
 * Una vista con datos del servidor no vuelve a mostrar carga mientras llega
 * su suscripción. La respuesta viva reemplaza esos datos al llegar, y una
 * consulta deshabilitada no presenta resultados de otro contexto.
 */
import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import { renderWithProviders, stubQuery } from "@/shared/testing/render";
import { useConvexQuery } from "./hooks";

function Pages({ enabled = true }: { enabled?: boolean }) {
  const result = useConvexQuery(api.pages.bySystem, { systemId: "system" }, {
    enabled, initialData: { items: [], restantes: 1 },
  });
  return <p>{result.isLoading ? "Cargando" : result.data ? `Restantes: ${result.data.restantes}` : "Sin datos"}</p>;
}

describe("datos iniciales de consultas", () => {
  it("pinta el resultado del servidor y luego el resultado vivo", () => {
    const { convex } = renderWithProviders(<Pages />);
    expect(screen.getByText("Restantes: 1")).toBeVisible();
    expect(screen.queryByText("Cargando")).not.toBeInTheDocument();
    act(() => convex.publish(stubQuery(api.pages.bySystem, { items: [], restantes: 2 })));
    expect(screen.getByText("Restantes: 2")).toBeVisible();
  });

  it("no usa datos iniciales cuando la consulta está deshabilitada", () => {
    renderWithProviders(<Pages enabled={false} />);
    expect(screen.getByText("Sin datos")).toBeVisible();
  });
});
