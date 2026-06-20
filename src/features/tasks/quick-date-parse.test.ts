import { describe, it, expect } from "vitest";
import { parseQuickDate, parseQuickInput } from "./quick-date-parse";

// Viernes 2026-06-12, 10:00 local.
const NOW = new Date(2026, 5, 12, 10, 0, 0);

describe("parseQuickDate", () => {
  it("devuelve null sin tokens de fecha", () => {
    expect(parseQuickDate("Comprar leche", NOW)).toBeNull();
    expect(parseQuickDate("Revisar 3 informes", NOW)).toBeNull();
  });

  it("detecta hoy / mañana / pasado mañana", () => {
    expect(parseQuickDate("Pagar luz hoy", NOW)).toEqual({
      title: "Pagar luz",
      dueDate: "2026-06-12",
      dueTime: undefined,
    });
    expect(parseQuickDate("Pagar luz mañana", NOW)?.dueDate).toBe("2026-06-13");
    expect(parseQuickDate("Pagar luz pasado mañana", NOW)).toMatchObject({
      title: "Pagar luz",
      dueDate: "2026-06-14",
    });
  });

  it("no confunde 'la mañana' (parte del día) con la fecha", () => {
    expect(parseQuickDate("Correr por la mañana", NOW)).toBeNull();
    expect(parseQuickDate("Limpiar esta mañana", NOW)).toBeNull();
  });

  it("detecta días de la semana como próxima ocurrencia estricta", () => {
    // NOW es viernes → "viernes" = el viernes siguiente.
    expect(parseQuickDate("Gym el lunes", NOW)).toMatchObject({
      title: "Gym",
      dueDate: "2026-06-15",
    });
    expect(parseQuickDate("Entrega viernes", NOW)?.dueDate).toBe("2026-06-19");
    expect(parseQuickDate("Llamar el miércoles", NOW)?.dueDate).toBe("2026-06-17");
    expect(parseQuickDate("Brunch sabado", NOW)?.dueDate).toBe("2026-06-13");
  });

  it("detecta horas con 'a las' (1–7 sin am/pm asume tarde)", () => {
    expect(parseQuickDate("Reunión mañana a las 5", NOW)).toEqual({
      title: "Reunión",
      dueDate: "2026-06-13",
      dueTime: "17:00",
    });
    expect(parseQuickDate("Standup hoy a las 9", NOW)?.dueTime).toBe("09:00");
    expect(parseQuickDate("Cena a las 8:30 pm hoy", NOW)?.dueTime).toBe("20:30");
  });

  it("detecta horas con am/pm sin 'a las'", () => {
    expect(parseQuickDate("Dentista mañana 3pm", NOW)).toEqual({
      title: "Dentista",
      dueDate: "2026-06-13",
      dueTime: "15:00",
    });
    expect(parseQuickDate("Vuelo lunes 12am", NOW)?.dueTime).toBe("00:00");
  });

  it("solo hora → hoy", () => {
    expect(parseQuickDate("Llamar a mamá a las 6", NOW)).toEqual({
      title: "Llamar a mamá",
      dueDate: "2026-06-12",
      dueTime: "18:00",
    });
  });

  it("no detecta números sueltos como hora", () => {
    expect(parseQuickDate("Leer capítulo 5 hoy", NOW)?.dueTime).toBeUndefined();
  });

  it("limpia el título sin dejar restos", () => {
    expect(parseQuickDate("mañana a las 5 Reunión equipo", NOW)?.title).toBe("Reunión equipo");
    expect(parseQuickDate("mañana", NOW)?.title).toBe("");
  });
});

describe("parseQuickInput", () => {
  it("devuelve null sin ningún token", () => {
    expect(parseQuickInput("Comprar leche", NOW)).toBeNull();
    expect(parseQuickInput("Revisar 3 informes", NOW)).toBeNull();
  });

  it("fecha sola funciona igual que parseQuickDate", () => {
    const result = parseQuickInput("comprar pan mañana", NOW);
    expect(result).toMatchObject({ dueDate: "2026-06-13", title: "comprar pan" });
  });

  it("prioridad !1..!4", () => {
    expect(parseQuickInput("pagar luz !1", NOW)).toMatchObject({ priority: "critical", title: "pagar luz" });
    expect(parseQuickInput("pagar luz !2", NOW)).toMatchObject({ priority: "high", title: "pagar luz" });
    expect(parseQuickInput("pagar luz !3", NOW)).toMatchObject({ priority: "medium", title: "pagar luz" });
    expect(parseQuickInput("pagar luz !4", NOW)).toMatchObject({ priority: "low", title: "pagar luz" });
  });

  it("prioridad por palabras clave", () => {
    expect(parseQuickInput("llamar urgente", NOW)).toMatchObject({ priority: "critical", title: "llamar" });
    expect(parseQuickInput("revisar importante", NOW)).toMatchObject({ priority: "high", title: "revisar" });
  });

  it("sistema (#nombre)", () => {
    expect(parseQuickInput("leer paper #estudio", NOW)).toMatchObject({
      systemHint: "estudio",
      title: "leer paper",
    });
  });

  it("etiqueta (@tag)", () => {
    expect(parseQuickInput("llamar banco @casa", NOW)).toMatchObject({
      tagHint: "casa",
      title: "llamar banco",
    });
  });

  it("duración 30min", () => {
    expect(parseQuickInput("revisar código 30min", NOW)).toMatchObject({
      estimatedMinutes: 30,
      title: "revisar código",
    });
  });

  it("duración 1h", () => {
    expect(parseQuickInput("deep work 1h", NOW)).toMatchObject({
      estimatedMinutes: 60,
      title: "deep work",
    });
  });

  it("duración 1h30", () => {
    expect(parseQuickInput("deep work 1h30", NOW)).toMatchObject({
      estimatedMinutes: 90,
      title: "deep work",
    });
  });

  it("todos los campos juntos", () => {
    const result = parseQuickInput("informe #trabajo !2 mañana 1h", NOW);
    expect(result).toMatchObject({
      dueDate: "2026-06-13",
      priority: "high",
      systemHint: "trabajo",
      estimatedMinutes: 60,
      title: "informe",
    });
  });
});
