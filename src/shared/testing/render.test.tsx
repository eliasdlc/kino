/**
 * Qué se prueba: que el harness monta el árbol que la app monta, y que
 * `renderMobile` cambia de rama de verdad en vez de renderizar la de
 * escritorio con otro ancho apuntado en una variable.
 *
 * Es el test del harness, no el de un componente. Si falla, ningún otro
 * `.test.tsx` del proyecto es de fiar.
 */

import { describe, expect, it } from "vitest";
import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import { makeTestConvexClient, renderMobile, renderWithProviders, stubQuery } from "./render";

// Ids inventados: nadie los resuelve contra una base, sólo viajan por props.
const SYSTEM_ID = "k1700000000000000000000000000000";
const tagId = (n: number) => `k17tag00000000000000000000000000${n}` as Id<"contextTags">;

function Ancho() {
  return <span>{useIsMobile() ? "móvil" : "escritorio"}</span>;
}

function Etiquetas() {
  const { data, isLoading } = useConvexQuery(api.tags.bySystem, { systemId: SYSTEM_ID });
  const borrar = useConvexMutation(api.tags.remove);
  if (isLoading) return <p>Cargando</p>;
  return (
    <ul>
      {data?.map((tag) => (
        <li key={tag.id}>
          {tag.title}
          <button onClick={() => borrar.mutate({ id: tag.id })}>Borrar</button>
        </li>
      ))}
    </ul>
  );
}

const UNA = stubQuery(api.tags.bySystem, [
  { id: tagId(1), title: "Profundo", color: "blue", systemId: null, isDefault: false },
]);

describe("el harness de test de componente", () => {
  it("renderWithProviders da la rama de escritorio y renderMobile la de móvil, sobre el mismo componente", () => {
    renderWithProviders(<Ancho />);
    expect(screen.getByText("escritorio")).toBeInTheDocument();

    cleanup();
    renderMobile(<Ancho />);
    expect(screen.getByText("móvil")).toBeInTheDocument();
  });

  it("las queries responden lo que el test dice, y un cambio del servidor repinta sin volver a montar", () => {
    const convex = makeTestConvexClient([UNA]);
    renderWithProviders(<Etiquetas />, { convex });

    expect(screen.getByText("Profundo")).toBeInTheDocument();

    act(() => {
      convex.publish(
        stubQuery(api.tags.bySystem, [
          { id: tagId(2), title: "Superficial", color: "gray", systemId: null, isDefault: false },
        ]),
      );
    });

    expect(screen.getByText("Superficial")).toBeInTheDocument();
    expect(screen.queryByText("Profundo")).not.toBeInTheDocument();
  });

  it("una mutación queda apuntada en vez de salir a la red", async () => {
    const convex = makeTestConvexClient([UNA]);
    renderWithProviders(<Etiquetas />, { convex });

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(convex.calls).toEqual([
      { kind: "mutation", name: "tags:remove", args: { id: tagId(1) } },
    ]);
  });

  it("sin cliente propio, una query se queda cargando y el componente no revienta", () => {
    renderWithProviders(<Etiquetas />);
    expect(screen.getByText("Cargando")).toBeInTheDocument();
  });
});
