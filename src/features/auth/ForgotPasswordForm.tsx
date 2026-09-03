"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/shared/lib/auth-client";
import { inputClass, cardClass, submitClass, errorClass } from "./form-styles";

/**
 * Pide el correo y dispara el envío del enlace de recuperación. La respuesta
 * es idéntica exista o no la cuenta: el servidor siempre contesta ok y aquí
 * siempre se muestra la misma confirmación, para no revelar quién está
 * registrado.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    if (error) {
      setError("No se pudo enviar el correo. Inténtalo de nuevo.");
      setLoading(false);
      return;
    }
    setSent(true);
  }

  return (
    <div>
      <div className="mb-7 text-center">
        <h1 className="mb-2 font-display text-[30px] font-extrabold tracking-[-0.02em] text-[#f4f4f5]">
          Recupera tu cuenta
        </h1>
        <p className="text-[15px] text-[#6b6b74]">
          Te enviamos un enlace para elegir una contraseña nueva.
        </p>
      </div>

      <div className={cardClass}>
        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-relaxed text-[#d4d4d8]">
              Si <span className="font-semibold text-[#f4f4f5]">{email}</span> tiene una
              cuenta en Kino, el enlace ya va en camino. Revisa también el spam.
            </p>
            <p className="text-[13px] text-[#6b6b74]">
              El enlace sirve una sola vez y caduca en una hora.
            </p>
            <Link
              href="/login"
              className="text-center text-[14px] font-semibold text-[#818cf8] transition-colors hover:text-[#a5b4fc]"
            >
              Volver a entrar
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-semibold text-[#d4d4d8]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="tu@email.com"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>

            {error && <p className={errorClass}>{error}</p>}

            <button type="submit" disabled={loading} className={submitClass}>
              {loading ? "Enviando…" : "Enviar enlace →"}
            </button>

            <Link
              href="/login"
              className="text-center text-[13px] text-[#6b6b74] transition-colors hover:text-[#a1a1aa]"
            >
              Volver a entrar
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
