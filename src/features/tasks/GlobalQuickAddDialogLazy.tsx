"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useQuickAddStore } from "./quick-add.store";

/**
 * El diálogo de nueva tarea arrastra el formulario entero (el calendario, el
 * selector de hora, los campos de planificación). Se descarga la primera vez
 * que el orbe, el atajo o el icono lo piden, y se queda montado. El atajo
 * `mod+i` vive aquí para funcionar desde la primera tecla.
 */
const GlobalQuickAddDialog = dynamic(
  () => import("./GlobalQuickAddDialog").then((m) => m.GlobalQuickAddDialog),
  { ssr: false },
);

export function GlobalQuickAddDialogLazy() {
  const open = useQuickAddStore((s) => s.open);
  const setOpen = useQuickAddStore((s) => s.setOpen);
  // Una vez pedido, se queda: el estado se ajusta en el render, sin efecto.
  const [pedido, setPedido] = useState(open);
  if (open && !pedido) setPedido(true);

  useHotkey(["mod+i"], (e) => {
    e.preventDefault();
    setOpen(true);
  });

  if (!pedido) return null;
  return <GlobalQuickAddDialog />;
}
