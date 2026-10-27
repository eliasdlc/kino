/**
 * Criterio: el diario de la obra se lee como Diario. Cada día es una fila con
 * su número en el margen y el día en palabras; terminar un capítulo va en
 * `--ok` y ningún hito se pinta en ámbar. Sin días, el vacío de la casa dice
 * qué falta en vez de una caja punteada.
 */
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { api } from "@convex/_generated/api";
import { makeTestConvexClient, renderWithProviders, stubQuery } from "@/shared/testing/render";
import { WorkJournalDialog } from "./WorkJournalDialog";

const sesion = { id: "s1", pageId: "p1", pageTitle: "La subida", wordsWritten: 820, durationMinutes: 95 };

function montar(days: unknown[]) {
  const journal = { folderId: "f1", folderName: "La marea baja", wordGoal: null, totalWords: 820, days };
  const convex = makeTestConvexClient([stubQuery(api.writing.journal, journal as never)]);
  renderWithProviders(
    <WorkJournalDialog folderId="f1" folderName="La marea baja" open onOpenChange={() => {}} />,
    { convex },
  );
}

describe("WorkJournalDialog", () => {
  it("cada día lleva su número en el margen y el capítulo terminado va en --ok", async () => {
    montar([
      {
        day: "2026-07-14",
        sessions: [sesion],
        words: 820,
        minutes: 95,
        cumulativeWords: 820,
        milestones: [
          { kind: "chapter-completed", pageId: "p1", pageTitle: "La subida" },
          { kind: "streak", days: 10 },
        ],
      },
    ]);
    const dia = (await screen.findAllByRole("listitem")).find((li) => li.dataset.slot === "journal-day")!;
    expect(within(dia).getByText("14")).toHaveClass("font-display", "text-muted-foreground");
    expect(within(dia).getByText(/martes, 14 de julio/)).toBeVisible();
    const iconos = dia.querySelectorAll("svg");
    expect(iconos[0]).toHaveClass("text-ok");
    expect(dia.querySelector(".text-primary")).toBeNull();
  });

  it("sin días enseña el vacío de la casa, con título y frase", async () => {
    montar([]);
    expect(await screen.findByRole("heading", { name: "Nada que releer todavía" })).toBeVisible();
    expect(screen.getByText("Escribe un rato y este diario se irá llenando solo.")).toBeVisible();
  });
});
