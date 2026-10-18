"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useQuickAddStore } from "./quick-add.store";

/**
 * El diálogo de nueva tarea arrastra el formulario entero (el calendario, el
 * selector de hora, los campos de planificación). Se descarga la primera vez
 * que el orbe, el atajo o el icono lo piden, y se queda montado. El atajo
 * `mod+i` vive aquí para funcionar desde la primera tecla.
 */
const cargar = () => import("./GlobalQuickAddDialog");
const GlobalQuickAddDialog = dynamic(
  () => cargar().then((m) => m.GlobalQuickAddDialog),
  { ssr: false },
);

export function GlobalQuickAddDialogLazy() {
  const open = useQuickAddStore((s) => s.open);
  const setOpen = useQuickAddStore((s) => s.setOpen);
  // Una vez pedido, se queda: el estado se ajusta en el render, sin efecto.
  const [pedido, setPedido] = useState(open);
  if (open && !pedido) setPedido(true);

  // El chunk baja cuando el navegador queda libre, para que el primer toque
  // no espere la descarga sin acuse; no entra en el bundle del shell.
  useEffect(() => {
    if (!("requestIdleCallback" in window)) return;
    const id = window.requestIdleCallback(() => void cargar(), { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }, []);

  useHotkey(["mod+i"], (e) => {
    e.preventDefault();
    setOpen(true);
  });

  if (!pedido) return null;
  return <GlobalQuickAddDialog />;
}
