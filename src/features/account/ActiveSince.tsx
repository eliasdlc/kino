"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

/**
 * Marca la cuenta como vista al entrar a la app. La mutación decide sola si
 * escribe: sólo lo hace una vez por día natural del usuario, así que montar
 * este componente en cada navegación no cuesta una escritura.
 *
 * Va en el layout y no en una query porque en Convex una lectura no escribe.
 * Espera a que el cliente tenga el token de Clerk; sin identidad la mutación
 * se rechaza.
 */
export function ActiveSince() {
  const { isAuthenticated } = useConvexAuth();
  const touch = useMutation(api.users.touch);
  const sent = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || sent.current) return;
    sent.current = true;
    void touch({}).catch(() => {
      // Que no se registre la visita no puede tumbar la pantalla.
      sent.current = false;
    });
  }, [isAuthenticated, touch]);

  return null;
}
