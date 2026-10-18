"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { clerkPuertaAppearance } from "./clerk-appearance";
import { safeNextPath } from "./next-path";
import { Puerta } from "./Puerta";
import { PUERTA_ENTRAR } from "./puertas.copy";

/** Entrar, con la contraseña olvidada y la verificación dentro del mismo flujo de Clerk. */
export function LoginPage() {
  const next = safeNextPath(useSearchParams().get("next"));
  return (
    <Puerta {...PUERTA_ENTRAR}>
      <SignIn forceRedirectUrl={next} signUpUrl="/register" appearance={clerkPuertaAppearance} />
    </Puerta>
  );
}
