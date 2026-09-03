"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { authClient } from "@/shared/lib/auth-client";

/**
 * Aviso persistente para cuentas que aún no confirmaron su correo. No bloquea
 * nada: la app funciona completa mientras tanto, pero sin confirmar no hay
 * recuperación de contraseña que llegue al buzón correcto. El layout deja de
 * renderizarlo en cuanto la sesión relee `emailVerified` en true.
 */
export function EmailVerificationBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/dashboard",
    });
    setState(error ? "error" : "sent");
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 border-b border-border bg-amber-500/10 px-4 py-2 text-[13px] text-foreground"
    >
      <MailWarning size={14} className="shrink-0 text-amber-500" aria-hidden />
      <span className="truncate">
        Confirma tu correo: te enviamos un enlace a{" "}
        <span className="font-medium">{email}</span>.
      </span>
      {state === "sent" ? (
        <span className="shrink-0 text-muted-foreground">Reenviado</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className="shrink-0 cursor-pointer font-semibold underline underline-offset-2 transition-colors hover:text-amber-500 disabled:opacity-60"
        >
          {state === "sending" ? "Enviando…" : state === "error" ? "Reintentar" : "Reenviar"}
        </button>
      )}
    </div>
  );
}
