/**
 * Lo que una fila de índice dice en el margen y en su meta. Puro y sin React,
 * para que el formato se pruebe sin montar nada.
 */

const ROMANOS: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** El numeral romano de una carpeta: I, II, III. Fuera de 1 a 3999, el arábigo. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  let resto = n;
  let salida = "";
  for (const [valor, letra] of ROMANOS) {
    while (resto >= valor) {
      salida += letra;
      resto -= valor;
    }
  }
  return salida;
}

/** Una cifra con el separador de miles de la casa: 80.000. */
export function formatCount(n: number): string {
  return n.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);
}

/** "hoy", "ayer" o "12 sept": cuándo se tocó un documento por última vez. */
export function relativeDay(date: Date | string | number | null | undefined, now: Date = new Date()): string | null {
  if (date === null || date === undefined) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((hoy - dia) / 86_400_000);
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}

/** "1 manuscrito", "3 manuscritos": la cuenta con su sustantivo en número. */
export function countNoun(n: number, noun: string, plural: string): string {
  return `${formatCount(n)} ${n === 1 ? noun : plural}`;
}

/** Junta los trozos de una meta con coma, sin dejar huecos. */
export function joinMeta(parts: ReadonlyArray<string | null | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(", ");
}
