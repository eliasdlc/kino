/**
 * Criterio: el panel dice cuánto queda en palabras y por peso, deja trabajar
 * un solo tipo de comentario a la vez, esconde la propuesta hasta que se pide
 * (la que se ve antes de pensar se acepta sin pensar), y cada cierre llega al
 * servidor con su forma: resuelto, o descartado con el motivo que leerá la
 * siguiente pasada.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from "@/shared/testing/render";
import { ReviewProvider } from "./ReviewContext";
import { ReviewPanelBody } from "./ReviewPanel";
import type { PageReviewView, ReviewComment } from "./reviews.types";

const AHORA = "2026-10-24T10:00:00.000Z";

function comentario(id: string, extra: Partial<ReviewComment>): ReviewComment {
  return {
    id: id as ReviewComment["id"],
    pageId: "page_1" as ReviewComment["pageId"],
    reviewId: "review_1" as NonNullable<ReviewComment["reviewId"]>,
    quote: "firewall perimetral",
    prefix: null,
    suffix: null,
    category: "evidence",
    severity: "critical",
    body: "Nombra qué controles faltan.",
    hint: null,
    suggestion: null,
    status: "open",
    resolution: null,
    resolvedAt: null,
    awaiting: null,
    author: "agent",
    replies: [],
    createdAt: AHORA,
    updatedAt: AHORA,
    ...extra,
  };
}

const CON_REVISION: PageReviewView = {
  reviews: [
    {
      id: "review_1" as PageReviewView["reviews"][number]["id"],
      summary: "El diagnóstico exagera los controles.",
      reviewer: "Claude",
      author: "agent",
      closedAt: null,
      createdAt: AHORA,
      progress: null,
    },
  ],
  comments: [
    comentario("c1", { suggestion: "tiene algunos controles, no todos" }),
    comentario("c2", { quote: "como prueba", category: "grammar", severity: "suggestion", body: "Falta la coma." }),
    comentario("c3", { quote: "respaldos", severity: "important", status: "resolved", resolution: "edited" }),
  ],
  progress: {
    total: 3,
    closed: 1,
    open: 2,
    fraction: 2 / 6,
    openBySeverity: { critical: 1, important: 0, suggestion: 1 },
    closedHow: { edited: 1, applied: 0, marked: 0, verified: 0, dismissed: 0 },
  },
  awaitingAgent: 0,
};

const VACIA: PageReviewView = {
  reviews: [],
  comments: [],
  progress: { ...CON_REVISION.progress, total: 0, closed: 0, open: 0, fraction: 0, openBySeverity: { critical: 0, important: 0, suggestion: 0 } },
  awaitingAgent: 0,
};

function montar(data: PageReviewView) {
  const cerrado = { comment: CON_REVISION.comments[0]!, reviewClosed: false };
  const convex = makeTestConvexClient(
    [stubQuery(api.reviews.byPage, data)],
    [stubMutation(api.reviews.resolve, cerrado), stubMutation(api.reviews.dismiss, cerrado)],
  );
  return renderWithProviders(
    <ReviewProvider initialOpen>
      <ReviewPanelBody pageId="page_1" title="Informe" />
    </ReviewProvider>,
    { convex },
  );
}

describe("el panel de revisión", () => {
  it("dice cuánto queda en palabras, no en porcentaje", async () => {
    montar(CON_REVISION);
    expect(await screen.findByText("1 de 3 cerrados")).toBeVisible();
    expect(screen.getByText("Quedan 1 crítico y 1 detalle")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByText("El diagnóstico exagera los controles.")).toBeVisible();
  });

  it("la leyenda de tipos filtra la lista, y volver a pulsarla la devuelve entera", async () => {
    montar(CON_REVISION);
    await screen.findByText("1 de 3 cerrados");
    const redaccion = screen.getByRole("button", { name: /Redacción/ });

    fireEvent.click(redaccion);
    expect(redaccion).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Falta la coma.")).toBeVisible();
    expect(screen.queryByText("Nombra qué controles faltan.")).not.toBeInTheDocument();

    fireEvent.click(redaccion);
    expect(screen.getByText("Nombra qué controles faltan.")).toBeVisible();
  });

  it("esconde la propuesta hasta que se pide", async () => {
    montar(CON_REVISION);
    await screen.findByText("1 de 3 cerrados");
    expect(screen.queryByText("tiene algunos controles, no todos")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver propuesta" }));
    expect(screen.getByText("tiene algunos controles, no todos")).toBeVisible();
  });

  it("resolver manda el comentario con su forma de cierre", async () => {
    const { convex } = montar(CON_REVISION);
    await screen.findByText("1 de 3 cerrados");
    fireEvent.click(screen.getAllByRole("button", { name: "Resuelto" })[0]!);

    await waitFor(() => expect(convex.calls.find((c) => c.name === "reviews:resolve")).toBeDefined());
    expect(convex.calls.find((c) => c.name === "reviews:resolve")!.args).toMatchObject({ resolution: "marked" });
  });

  it("descartar pide un motivo y lo manda para la siguiente pasada", async () => {
    const { convex } = montar(CON_REVISION);
    await screen.findByText("1 de 3 cerrados");
    fireEvent.click(screen.getAllByRole("button", { name: "Descartar" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Lo quiero así" }));

    await waitFor(() => expect(convex.calls.find((c) => c.name === "reviews:dismiss")).toBeDefined());
    expect(convex.calls.find((c) => c.name === "reviews:dismiss")!.args).toMatchObject({ reason: "Lo quiero así" });
  });

  it("los cerrados van en su pestaña, con cómo se cerraron", async () => {
    montar(CON_REVISION);
    await screen.findByText("1 de 3 cerrados");
    expect(screen.queryByText("Lo arreglaste tú")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Cerrados (1)" }));
    expect(screen.getByText("Lo arreglaste tú")).toBeVisible();
  });

  it("sin revisión, ofrece pedírsela al agente", async () => {
    montar(VACIA);
    expect(await screen.findByRole("button", { name: "Pedir una revisión" })).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
