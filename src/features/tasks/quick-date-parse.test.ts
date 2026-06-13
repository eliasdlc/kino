import { describe, it, expect } from "vitest";
import { parseQuickDate } from "./quick-date-parse";

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
