"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useCommandPaletteStore } from "./command-palette.store";

/**
 * La paleta pesa (cmdk, la búsqueda, sus resultados) y casi nadie la abre en
 * una visita, así que no entra en el chunk del shell: se descarga la primera
 * vez que alguien la pide y se queda montada desde entonces. Lo que sí vive
 * aquí, ligero, es el atajo: `mod+k` tiene que funcionar antes de que la
 * paleta exista.
 */
const GlobalCommandPalette = dynamic(
  () => import("./GlobalCommandPalette").then((m) => m.GlobalCommandPalette),
  { ssr: false },
);

export function GlobalCommandPaletteLazy() {
  const open = useCommandPaletteStore((s) => s.open);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  // Una vez pedida, se queda: el estado se ajusta en el render, sin efecto.
  const [pedida, setPedida] = useState(open);
  if (open && !pedida) setPedida(true);

  useHotkey(["mod+k"], (e) => {
    e.preventDefault();
    toggle();
  });

  if (!pedida) return null;
  return <GlobalCommandPalette />;
}
