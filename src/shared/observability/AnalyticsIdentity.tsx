"use client";

import { useEffect, useRef } from "react";
import { identifyUser, takePendingSignup, track } from "./analytics.client";

/**
 * Pone nombre a la persona en cuanto hay sesión, y anuncia la cuenta creada si
 * viene de un registro.
 *
 * Va en los layouts de la app y del onboarding porque son los dos sitios donde
 * se aterriza después de registrarse, con correo o con Google, y así el evento
 * de cuenta creada es uno solo para los dos caminos: el formulario no puede
 * dispararlo porque el login social se va a otro dominio y vuelve por un
 * redirect.
 *
 * Sin cookies no se guarda la identidad entre cargas, así que identificar en
 * cada montaje no es un descuido: es lo que hace que el funnel siga siendo el
 * de la misma persona al día siguiente.
 */
export function AnalyticsIdentity({ userId }: { userId: string }) {
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (done.current === userId) return;
    done.current = userId;

    const signup = takePendingSignup();
    identifyUser(userId, { segment: signup?.segment });
    if (signup) {
      track(
        "signup_completed",
        { method: signup.method, segment: signup.segment },
        new Date(signup.at),
      );
    }
  }, [userId]);

  return null;
}
