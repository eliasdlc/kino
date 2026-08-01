import { describe, expect, it } from "vitest";
import { parseFolderMetadata } from "./folders.metadata";

describe("parseFolderMetadata", () => {
  it("acepta los campos declarados por el arquetipo Academic", () => {
    const res = parseFolderMetadata("academic", {
      professor: "Ada Lovelace",
      schedule: "Lun/Mié 10:00",
      semester: "2026-1",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual({
        professor: "Ada Lovelace",
        schedule: "Lun/Mié 10:00",
        semester: "2026-1",
      });
    }
  });

  it("rechaza claves fuera del manifiesto (metadata no es un saco)", () => {
    const res = parseFolderMetadata("academic", { professor: "X", hackerField: "boom" });
    expect(res.success).toBe(false);
  });

  it("valida targetDate como fecha en Entrepreneurial", () => {
    expect(parseFolderMetadata("entrepreneurial", { targetDate: "2026-09-01" }).success).toBe(true);
    expect(parseFolderMetadata("entrepreneurial", { targetDate: "no-es-fecha" }).success).toBe(false);
  });

  it("descarta strings vacíos y devuelve null si no queda nada", () => {
    const res = parseFolderMetadata("academic", { professor: "  ", schedule: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBeNull();
  });

  it("trata null/undefined como ausencia de metadata", () => {
    expect(parseFolderMetadata("academic", null)).toEqual({ success: true, data: null });
    expect(parseFolderMetadata("academic", undefined)).toEqual({ success: true, data: null });
  });

  it("coacciona wordGoal (string del form) a número en Writing", () => {
    const res = parseFolderMetadata("writing", { medium: "novel", wordGoal: "50000" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toEqual({ medium: "novel", wordGoal: 50000 });
  });

  it("el medium es un enum cerrado sobre las opciones del manifiesto (W3)", () => {
    expect(parseFolderMetadata("writing", { medium: "screenplay" }).success).toBe(true);
    // El texto libre que aceptaba W1/W2 ya no entra: se normaliza al leer, no al
    // escribir (resolveMedium), así que ninguna obra vieja se rompe.
    expect(parseFolderMetadata("writing", { medium: "novela" }).success).toBe(false);
    expect(parseFolderMetadata("writing", { medium: "cualquier cosa" }).success).toBe(false);
  });

  it("un arquetipo sin campos de folder rechaza cualquier metadata no vacía", () => {
    // personal.folderRole.fields === [] → schema estricto vacío.
    expect(parseFolderMetadata("personal", { anything: "x" }).success).toBe(false);
    expect(parseFolderMetadata("personal", {}).success).toBe(true);
  });
});
