"use client";

import { useEffect, useRef } from "react";
import { track } from "./analytics.client";
import type { AnalyticsEvent, AnalyticsProperties } from "./analytics";

/**
 * Dispara un evento del funnel cuando la pantalla aparece, una sola vez por
 * montaje. Existe porque las landings de segmento son componentes de servidor y
 * no pueden llamar a `track` por su cuenta.
 *
 * El pestillo importa: en desarrollo React monta dos veces a propósito, y ver
 * el evento duplicado en el panel justo mientras se comprueba el funnel es la
 * forma más fácil de desconfiar de un número que está bien.
 */
export function TrackOnMount<E extends AnalyticsEvent>({
  event,
  properties,
}: {
  event: E;
  properties?: AnalyticsProperties<E>;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, properties);
    // Las propiedades quedan fijadas en el primer render: este evento es la
    // llegada a la pantalla, no cada cambio de lo que la pantalla muestra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
