"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuickAddStore } from "./quick-add.store";

/**
 * El atajo del icono en el teléfono. `public/manifest.json` declara «Nueva
 * tarea» apuntando a `/dashboard?action=new-task`, y hasta ahora nadie leía ese
 * parámetro: mantenías pulsado el icono, elegías Nueva tarea, y aterrizabas en
 * Hoy sin diálogo. Un control que no hace nada no se pinta, así que la salida
 * era leerlo, no borrar la entrada del menú.
 *
 * El parámetro se retira de la URL en cuanto abre el diálogo: si se quedara,
 * recargar o volver atrás lo volvería a abrir.
 */
export const QUICK_ADD_PARAM = "action";
export const QUICK_ADD_VALUE = "new-task";

export function QuickAddFromUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setOpen = useQuickAddStore((s) => s.setOpen);

  useEffect(() => {
    if (searchParams.get(QUICK_ADD_PARAM) !== QUICK_ADD_VALUE) return;
    setOpen(true);
    const resto = new URLSearchParams(searchParams);
    resto.delete(QUICK_ADD_PARAM);
    router.replace(resto.size > 0 ? `${pathname}?${resto}` : pathname);
  }, [searchParams, pathname, router, setOpen]);

  return null;
}
