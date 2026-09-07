/**
 * Criterio: después de correr el hook a mano, Ajustes enseña una fila con la
 * fecha y el tamaño del último resumen, y nunca su contenido. Sin ninguno lo
 * dice en una frase, con el mismo tamaño de letra que la fila.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { DigestsSection } from "./DigestsSection";

const conDigests = (value: Parameters<typeof stubQuery<typeof api.digests.list>>[1]) =>
  makeTestConvexClient([stubQuery(api.digests.list, value)]);

/** Los ids de Convex son opacos y el fixture no pasa por la base. */
const idDigest = (value: string) => value as Id<"sessionDigests">;

describe("DigestsSection", () => {
  it("una fila por resumen, con su fecha y su tamaño", () => {
    renderWithProviders(<DigestsSection />, {
      convex: conDigests([
        { id: idDigest("d1"), source: "claude-code", externalId: "s1", createdAt: "2026-09-07T14:30:00.000Z", bytes: 4321 },
        { id: idDigest("d2"), source: "claude-code", externalId: "s2", createdAt: "2026-09-06T09:00:00.000Z", bytes: 512 },
      ]),
    });
    expect(screen.getByText("4.2 KB")).toBeVisible();
    expect(screen.getByText("512 B")).toBeVisible();
    expect(screen.getAllByText("claude-code")).toHaveLength(2);
  });

  it("sin ningún resumen lo dice en vez de dejar el hueco", () => {
    renderWithProviders(<DigestsSection />, { convex: conDigests([]) });
    expect(screen.getByText("Todavía no ha llegado ningún resumen.")).toBeVisible();
  });
});
