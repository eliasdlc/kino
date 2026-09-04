"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

/**
 * Crear cuenta. El segmento de la landing por arquetipo viaja en la URL y
 * sigue viajando hasta el onboarding, que es quien lo lee.
 */
export function RegisterPage() {
  const segment = useSearchParams().get("para");
  const after = segment ? `/onboarding?para=${encodeURIComponent(segment)}` : "/onboarding";
  return <SignUp forceRedirectUrl={after} signInUrl="/login" />;
}
