import type { MediumUnit } from "@/shared/lib/mediums";

/**
 * El sustantivo de cada manuscrito con su género, para no componer «el escena»
 * ni «Escena terminado». El manifiesto no guarda el género, pero su etiqueta de
 * creación ya lo dice («Nuevo capítulo», «Nueva escena»): se lee de ahí, así un
 * medium nuevo concuerda sin tocar esta tabla.
 */
export interface Unidad {
  /** «capítulo», «escena». */
  noun: string;
  /** «Capítulo», «Escena». */
  Noun: string;
  femenina: boolean;
  /** «el capítulo», «la escena». */
  el: string;
  /** «este capítulo», «esta escena». */
  este: string;
  /** «Este capítulo», «Esta escena». */
  Este: string;
  /** «del capítulo», «de la escena». */
  del: string;
  /** «terminado», «terminada». */
  terminado: string;
}

const CAPITULO: MediumUnit = { noun: "capítulo", nounPlural: "capítulos", newLabel: "Nuevo capítulo" };

export function unidadDe(unit?: MediumUnit | null): Unidad {
  const u = unit ?? CAPITULO;
  const femenina = /^nueva\b/i.test(u.newLabel.trim());
  const noun = u.noun;
  const este = `${femenina ? "esta" : "este"} ${noun}`;
  return {
    noun,
    Noun: noun.charAt(0).toUpperCase() + noun.slice(1),
    femenina,
    el: `${femenina ? "la" : "el"} ${noun}`,
    este,
    Este: este.charAt(0).toUpperCase() + este.slice(1),
    del: `${femenina ? "de la" : "del"} ${noun}`,
    terminado: femenina ? "terminada" : "terminado",
  };
}
