import { describe, expect, it } from "vitest";
import { PROJECT_BOARD_TERMINAL } from "@/shared/lib/system-types";
import {
  boardStatusFor,
  externalIdFor,
  INITIAL_BOARD_COLUMN,
  isEmptyPatch,
  KINO_OWNED_FIELDS,
  newTaskFromIssue,
  taskDescriptionFor,
  taskPatchFromIssue,
  taskTitleFor,
  type ExistingTask,
} from "./github-sync.mapper";
import type { GithubIssue } from "./github-sync.types";

function issue(over: Partial<GithubIssue> = {}): GithubIssue {
  return {
    id: 2_100_400_900,
    number: 42,
    title: "Arreglar el rollover del plan",
    body: "Se queda pegado al cambiar de día.",
    state: "open",
    htmlUrl: "https://github.com/eliasdlc/kino/issues/42",
    milestone: null,
    ...over,
  };
}

function existing(over: Partial<ExistingTask> = {}): ExistingTask {
  const base = newTaskFromIssue(issue());
  return {
    title: base.title,
    description: base.description,
    boardStatus: base.boardStatus,
    sprintId: null,
    ...over,
  };
}

describe("identidad del issue", () => {
  // El id numérico es único en todo GitHub; el `number` sólo lo es dentro del
  // repo, así que usarlo cruzaría issues de repositorios distintos.
  it("usa el id global, no el número visible", () => {
    expect(externalIdFor(issue({ id: 999, number: 1 }))).toBe("999");
  });
});

describe("título y descripción", () => {
  it("antepone el número del issue para poder identificar la tarjeta", () => {
    expect(taskTitleFor(issue())).toBe("#42 Arreglar el rollover del plan");
  });

  it("no revienta el límite de la columna", () => {
    expect(taskTitleFor(issue({ title: "x".repeat(900) })).length).toBe(500);
  });

  it("sobrevive a un issue sin título", () => {
    expect(taskTitleFor(issue({ title: "   " }))).toBe("#42 (sin título)");
  });

  it("adjunta el enlace, que es lo que hace la tarjeta una puerta a GitHub", () => {
    expect(taskDescriptionFor(issue())).toBe(
      "Se queda pegado al cambiar de día.\n\nhttps://github.com/eliasdlc/kino/issues/42",
    );
  });

  it("con el cuerpo vacío deja sólo el enlace", () => {
    expect(taskDescriptionFor(issue({ body: null }))).toBe(
      "https://github.com/eliasdlc/kino/issues/42",
    );
  });
});

describe("boardStatusFor · qué columna le toca al issue", () => {
  it("una tarjeta nueva de issue abierto entra en la primera columna", () => {
    expect(boardStatusFor("open", null)).toBe(INITIAL_BOARD_COLUMN);
  });

  it("un issue cerrado va a la columna terminal", () => {
    expect(boardStatusFor("closed", INITIAL_BOARD_COLUMN)).toBe(
      PROJECT_BOARD_TERMINAL,
    );
  });

  it("un issue cerrado que ya estaba en la terminal no se mueve", () => {
    expect(boardStatusFor("closed", PROJECT_BOARD_TERMINAL)).toBeNull();
  });

  it("reabrir en GitHub saca la tarjeta de la terminal", () => {
    expect(boardStatusFor("open", PROJECT_BOARD_TERMINAL)).toBe(
      INITIAL_BOARD_COLUMN,
    );
  });

  // El caso que decide si el board sirve o estorba: si el refresco devolviera
  // las tarjetas a "por hacer", mover una tarjeta en Kino no significaría nada.
  it.each(["in_progress", "review"])(
    "no toca la columna intermedia %s de un issue abierto",
    (columna) => {
      expect(boardStatusFor("open", columna)).toBeNull();
    },
  );
});

describe("newTaskFromIssue", () => {
  it("marca el origen para que el upsert la reconozca", () => {
    const nueva = newTaskFromIssue(issue());

    expect(nueva.externalSource).toBe("github");
    expect(nueva.externalId).toBe("2100400900");
  });

  it("un issue abierto nace en la primera columna y sin completar", () => {
    const nueva = newTaskFromIssue(issue());

    expect(nueva.boardStatus).toBe(INITIAL_BOARD_COLUMN);
    expect(nueva.status).toBe("backlog");
  });

  // Importar tarde un issue ya cerrado no debería obligar a cerrarlo a mano.
  it("un issue ya cerrado nace completado y en la terminal", () => {
    const nueva = newTaskFromIssue(issue({ state: "closed" }));

    expect(nueva.boardStatus).toBe(PROJECT_BOARD_TERMINAL);
    expect(nueva.status).toBe("done");
  });
});

describe("taskPatchFromIssue · re-sincronizar", () => {
  it("sin cambios no propone nada", () => {
    const patch = taskPatchFromIssue(issue(), existing(), null);

    expect(isEmptyPatch(patch)).toBe(true);
  });

  it("renombrar el issue actualiza el título en vez de duplicar", () => {
    const patch = taskPatchFromIssue(
      issue({ title: "Nombre nuevo" }),
      existing(),
      null,
    );

    expect(patch.title).toBe("#42 Nombre nuevo");
    expect(isEmptyPatch(patch)).toBe(false);
  });

  it("editar el cuerpo actualiza la descripción", () => {
    const patch = taskPatchFromIssue(
      issue({ body: "Otra explicación." }),
      existing(),
      null,
    );

    expect(patch.description).toContain("Otra explicación.");
  });

  it("cerrar el issue mueve la tarjeta a la terminal", () => {
    const patch = taskPatchFromIssue(
      issue({ state: "closed" }),
      existing({ boardStatus: INITIAL_BOARD_COLUMN }),
      null,
    );

    expect(patch.boardStatus).toBe(PROJECT_BOARD_TERMINAL);
  });

  it("asigna el sprint del milestone", () => {
    const patch = taskPatchFromIssue(
      issue({
        milestone: {
          id: 7,
          title: "Sprint 3",
          description: null,
          dueOn: null,
          state: "open",
        },
      }),
      existing(),
      "sprint-uuid",
    );

    expect(patch.sprintId).toBe("sprint-uuid");
  });

  it("no reasigna un sprint que ya era el correcto", () => {
    const patch = taskPatchFromIssue(
      issue({
        milestone: {
          id: 7,
          title: "Sprint 3",
          description: null,
          dueOn: null,
          state: "open",
        },
      }),
      existing({ sprintId: "sprint-uuid" }),
      "sprint-uuid",
    );

    expect(patch.sprintId).toBeUndefined();
    expect(isEmptyPatch(patch)).toBe(true);
  });

  // GitHub sin milestone no está diciendo "sácalo del sprint", está diciendo que
  // no opina: y la asignación pudo hacerla la persona desde Kino.
  it("un issue sin milestone no limpia el sprint asignado a mano", () => {
    const patch = taskPatchFromIssue(
      issue({ milestone: null }),
      existing({ sprintId: "puesto-a-mano" }),
      null,
    );

    expect(patch.sprintId).toBeUndefined();
  });

  // La razón de ser del ticket: si un refresco borra lo que Kino añadió, el
  // feature destruye trabajo en vez de crearlo.
  it("el parche nunca contiene un campo propio de Kino", () => {
    const patch = taskPatchFromIssue(
      issue({ title: "Cambio", state: "closed" }),
      existing({ boardStatus: "in_progress" }),
      "sprint-uuid",
    );

    for (const campo of KINO_OWNED_FIELDS) {
      expect(patch).not.toHaveProperty(campo);
    }
  });

  it("la lista de campos protegidos cubre lo que el ticket exige", () => {
    expect(KINO_OWNED_FIELDS).toEqual(
      expect.arrayContaining([
        "energyLevel",
        "dueDate",
        "inTodayPlan",
        "startDate",
      ]),
    );
  });
});
