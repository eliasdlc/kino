"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "./next-path";

/** Entrar, con la contraseña olvidada y la verificación dentro del mismo flujo de Clerk. */
export function LoginPage() {
  const next = safeNextPath(useSearchParams().get("next"));
  return <SignIn forceRedirectUrl={next} signUpUrl="/register" />;
}
