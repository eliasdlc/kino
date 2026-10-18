/**
 * Criterio: Sistemas es un índice, no una rejilla de tarjetas. La Bandeja va
 * primero y lleva a /bandeja, dormido va en coral delante de la meta, buscar
 * aparece sólo cuando hay sistemas que buscar, y sin sistemas hay una acción.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import { makeSystem, mid } from "@/app/system-design/mock-data";
import { makeTestConvexClient, renderMobile, stubQuery } from "@/shared/testing/render";
import { BUSCAR_DESDE, SystemsList } from "./SystemsList";

const bandeja = makeSystem({ id: mid("inbox"), name: "Inbox", isInbox: true, templateType: "inbox", activeTaskCount: 4 });

function con(systems: ReturnType<typeof makeSystem>[]) {
  return makeTestConvexClient([stubQuery(api.systems.list, systems)]);
}

describe("SystemsList", () => {
  it("pone la Bandeja primero, con el nombre del pie y su ruta", async () => {
    renderMobile(<SystemsList />, {
      convex: con([makeSystem({ id: mid("a"), name: "Universidad" }), bandeja]),
    });

    const enlaces = await screen.findAllByRole("link");
    expect(enlaces[0]).toHaveTextContent("Bandeja");
    expect(enlaces[0]).toHaveAttribute("href", "/bandeja");
    expect(screen.getByText("4 sin repartir")).toBeInTheDocument();
    expect(enlaces[1]).toHaveAttribute("href", `/systems/${mid("a")}`);
  });

  it("un sistema dormido lo dice en coral delante de su meta", async () => {
    renderMobile(<SystemsList />, {
      convex: con([bandeja, makeSystem({ id: mid("s"), name: "Salud", templateType: "personal", stale: true })]),
    });
    expect(await screen.findByText("dormido,")).toHaveClass("text-task-overdue");
  });

  it("buscar sólo aparece cuando hay sistemas que buscar", async () => {
    const pocos = Array.from({ length: BUSCAR_DESDE - 1 }, (_, i) => makeSystem({ id: mid(`s${i}`), name: `S${i}` }));
    const { unmount } = renderMobile(<SystemsList />, { convex: con(pocos) });
    await screen.findByText("S0");
    expect(screen.queryByRole("searchbox", { name: "Buscar sistemas" })).not.toBeInTheDocument();
    unmount();

    const muchos = Array.from({ length: BUSCAR_DESDE }, (_, i) => makeSystem({ id: mid(`m${i}`), name: `M${i}` }));
    renderMobile(<SystemsList />, { convex: con(muchos) });
    expect(await screen.findByRole("searchbox", { name: "Buscar sistemas" })).toBeInTheDocument();
  });

  it("sin sistemas propios dice qué es uno y ofrece crearlo", async () => {
    renderMobile(<SystemsList />, { convex: con([bandeja]) });
    expect(await screen.findByRole("heading", { name: "Todavía no tienes sistemas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear sistema" })).toBeInTheDocument();
  });
});
