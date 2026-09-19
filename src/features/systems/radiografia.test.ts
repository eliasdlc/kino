import { describe, expect, it } from "vitest";
import {
  buildSystemFacts,
  describeSystem,
  isUnstarted,
  FACTS_MAX,
  type RadiografiaSignals,
  type FactRow,
  type Noun,
} from "./radiografia";

/**
 * Lo que se prueba aquí es la promesa del panel, no su aritmética: que ningún
 * hecho se pinta sin la fila que lo respalda, que seis es un techo y no un
 * objetivo, y que el párrafo habla con el vocabulario del arquetipo.
 */

const CLASE: Noun = { one: "clase", many: "clases", gender: "f" };
const APUNTE: Noun = { one: "apunte", many: "apuntes", gender: "m" };
const MILESTONE: Noun = { one: "milestone", many: "milestones", gender: "m" };
const DOC: Noun = { one: "doc", many: "docs", gender: "m" };

function fila(id: string, title: string, day = "3 de agosto"): FactRow {
  return { target: { kind: "task", id }, title, at: "2026-08-03T16:00:00.000Z", day };
}

/** Un sistema sin una sola señal. Cada prueba enciende sólo lo que mira. */
function senales(extra: Partial<RadiografiaSignals> = {}): RadiografiaSignals {
  return {
    today: "16 de septiembre",
    container: CLASE,
    containerCount: 0,
    page: APUNTE,
    pageCount: 0,
    openCount: 0,
    closedCount: 0,
    daysSinceCreated: 0,
    overdue: null,
    pileup: null,
    stalled: null,
    nextDue: null,
    emptyContainers: null,
    lastMove: null,
    lastClosed: null,
    observed: null,
    ...extra,
  };
}

/** Las ocho señales encendidas a la vez, que son dos más que el techo. */
function todas(): RadiografiaSignals {
  return senales({
    openCount: 12,
    closedCount: 30,
    containerCount: 3,
    pageCount: 4,
    overdue: { count: 2, oldest: fila("t1", "Entrega de Cálculo") },
    pileup: { column: "Backlog", count: 7, oldest: fila("t2", "Leer el capítulo 4"), days: 21 },
    stalled: { row: fila("t3", "Montar el laboratorio"), days: 18 },
    nextDue: { row: fila("t4", "Examen parcial", "20 de septiembre"), inDays: 4 },
    emptyContainers: { count: 1, first: { ...fila("f1", "Álgebra"), target: { kind: "folder", id: "f1" } } },
    lastMove: { row: fila("t5", "Práctica 3"), days: 2 },
    lastClosed: { row: fila("t6", "Resumen de la unidad 2"), days: 5 },
    observed: { minutes: 400, sessions: 9, last: fila("t7", "Tarea larga") },
  });
}

describe("los hechos dla radiografía", () => {
  it("un sistema sin señales no pinta ningún hecho, en vez de pintar huecos", () => {
    expect(buildSystemFacts(senales())).toEqual([]);
  });

  it("con una sola señal pinta un solo hecho", () => {
    const facts = buildSystemFacts(senales({ lastClosed: { row: fila("t1", "Entrega 1"), days: 3 } }));

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      kind: "last-closed",
      title: "Lo último que cerraste fue «Entrega 1»",
      reason: "Hace 3 días, el 3 de agosto.",
      target: { kind: "task", id: "t1" },
      occurredAt: "2026-08-03T16:00:00.000Z",
    });
  });

  it("seis es un techo: con ocho señales se quedan las seis de más peso, en orden", () => {
    const facts = buildSystemFacts(todas());

    expect(facts).toHaveLength(FACTS_MAX);
    expect(facts.map((fact) => fact.kind)).toEqual([
      "overdue",
      "pileup",
      "stalled",
      "next-due",
      "empty-container",
      "last-move",
    ]);
  });

  it("cada hecho lleva su fila y su fecha, sin excepción", () => {
    for (const fact of buildSystemFacts(todas())) {
      expect(fact.target.id, fact.kind).not.toBe("");
      expect(Number.isNaN(Date.parse(fact.occurredAt)), fact.kind).toBe(false);
      expect(fact.reason.length, fact.kind).toBeGreaterThan(0);
    }
  });

  it("el hecho de los contenedores calla cuando el arquetipo no los ofrece", () => {
    const vacias = { count: 2, first: { ...fila("f1", "Álgebra"), target: { kind: "folder" as const, id: "f1" } } };

    expect(buildSystemFacts(senales({ emptyContainers: vacias, container: CLASE }))).toHaveLength(1);
    expect(buildSystemFacts(senales({ emptyContainers: vacias, container: null }))).toEqual([]);
  });

  it("un título largo se cita recortado: la razón existe para enseñar el dato, no el título", () => {
    const largo = "Terminar la demostración del teorema de Green para la región anular y comparar el resultado a mano";
    const [hecho] = buildSystemFacts(senales({ overdue: { count: 1, oldest: fila("t1", largo) } }));

    expect(hecho.reason).toContain("«Terminar la demostración del teorema de Green para la regió…»");
    expect(hecho.reason.length).toBeLessThan(largo.length);
  });

  it("los contenedores hablan con el sustantivo y el género del arquetipo", () => {
    const vacias = { count: 2, first: { ...fila("f1", "Primer hito"), target: { kind: "folder" as const, id: "f1" } } };

    const academico = buildSystemFacts(senales({ emptyContainers: vacias, container: CLASE }))[0];
    const emprendimiento = buildSystemFacts(senales({ emptyContainers: vacias, container: MILESTONE }))[0];

    expect(academico.title).toBe("2 clases sin una sola tarea");
    expect(academico.reason).toContain("sigue vacía");
    expect(emprendimiento.title).toBe("2 milestones sin una sola tarea");
    expect(emprendimiento.reason).toContain("sigue vacío");
  });
});

describe("el párrafo de estado", () => {
  it("abre con la fecha y cuenta lo que existe, con el vocabulario del arquetipo", () => {
    const texto = describeSystem(
      senales({ openCount: 8, closedCount: 34, containerCount: 3, pageCount: 12 }),
    );

    expect(texto).toBe("Al 16 de septiembre este sistema tiene 8 tareas vivas, 34 cerradas, 3 clases y 12 apuntes.");
  });

  it("dos arquetipos con los mismos números no dicen la misma frase", () => {
    const numeros = { openCount: 8, closedCount: 34, containerCount: 3, pageCount: 12 };
    const academico = describeSystem(senales({ ...numeros, container: CLASE, page: APUNTE }));
    const proyecto = describeSystem(senales({ ...numeros, container: null, page: DOC }));

    expect(academico).toContain("3 clases y 12 apuntes");
    expect(proyecto).toContain("34 cerradas y 12 docs");
    expect(proyecto).not.toContain("clase");
  });

  it("una cláusula sin número desaparece en vez de decir cero", () => {
    const texto = describeSystem(senales({ openCount: 1, closedCount: 0, containerCount: 0, pageCount: 0 }));

    expect(texto).toBe("Al 16 de septiembre este sistema tiene 1 tarea viva.");
  });

  it("un sistema con todo cerrado no dice que tiene cero tareas vivas", () => {
    const texto = describeSystem(senales({ openCount: 0, closedCount: 0, pageCount: 5 }));

    expect(texto).toBe("Al 16 de septiembre este sistema tiene 5 apuntes.");
    expect(texto).not.toContain("0 tareas");
  });

  it("sin una sola cifra que dar, la frase sigue siendo una frase", () => {
    const movido = senales({ lastMove: { row: fila("t1", "Algo"), days: 1 } });

    expect(isUnstarted(movido)).toBe(false);
    expect(describeSystem(movido)).toBe("Al 16 de septiembre este sistema no tiene ninguna tarea.");
  });

  it("el tiempo observado va en su propia frase y sólo cuando hubo sesiones", () => {
    const con = describeSystem(
      senales({ openCount: 2, observed: { minutes: 400, sessions: 9, last: fila("t1", "Tarea") } }),
    );

    expect(con).toContain("El tiempo observado de los últimos 30 días suma 6 h 40 en 9 sesiones.");
    expect(describeSystem(senales({ openCount: 2 }))).not.toContain("tiempo observado");
  });

  it("un sistema recién creado dice que no hay nada que contar, no un párrafo de ceros", () => {
    const nuevo = senales({ daysSinceCreated: 2 });

    expect(isUnstarted(nuevo)).toBe(true);
    expect(describeSystem(nuevo)).toBe(
      "Al 16 de septiembre este sistema está vacío: se creó hace 2 días y todavía no hay nada que contar.",
    );
  });

  it("un sistema con todo cerrado ya no está sin empezar, está tranquilo", () => {
    const tranquilo = senales({ openCount: 0, closedCount: 12, lastClosed: { row: fila("t1", "Último"), days: 40 } });

    expect(isUnstarted(tranquilo)).toBe(false);
  });
});
