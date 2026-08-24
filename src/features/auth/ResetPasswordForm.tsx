"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/shared/lib/auth-client";
import { inputClass, cardClass, submitClass, errorClass } from "./form-styles";

/**
 * Pantalla a la que aterriza el enlace del correo. Better Auth valida el token
 * en su callback y llega aquí como `?token=...`; si venció o ya se usó, llega
 * `?error=INVALID_TOKEN` y se ofrece pedir otro. El token sirve una sola vez.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidLink = !token || searchParams.get("error") !== null;

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);

    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setError(
        error.code === "INVALID_TOKEN"
          ? "El enlace ya no es válido. Pide uno nuevo."
          : (error.message ?? "No se pudo cambiar la contraseña"),
      );
      setLoading(false);
      return;
    }
    router.push("/login?reset=1");
  }

  return (
    <div>
      <div className="mb-7 text-center">
        <h1 className="mb-2 font-display text-[30px] font-extrabold tracking-[-0.02em] text-[#f4f4f5]">
          Contraseña nueva
        </h1>
        <p className="text-[15px] text-[#6b6b74]">
          {invalidLink ? "Este enlace ya no sirve." : "Elígela y listo: no se cierra nada más."}
        </p>
      </div>

      <div className={cardClass}>
        {invalidLink ? (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-relaxed text-[#d4d4d8]">
              Los enlaces de recuperación sirven una sola vez y caducan en una hora.
              Pide uno nuevo y usa el correo más reciente.
            </p>
            <Link
              href="/forgot-password"
              className="text-center text-[14px] font-semibold text-[#818cf8] transition-colors hover:text-[#a5b4fc]"
            >
              Pedir otro enlace
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-semibold text-[#d4d4d8]">
                Contraseña nueva
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
                className={inputClass}
              />
            </div>

            {error && <p className={errorClass}>{error}</p>}

            <button type="submit" disabled={loading} className={submitClass}>
              {loading ? "Guardando…" : "Cambiar contraseña →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
