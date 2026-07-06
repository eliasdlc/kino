"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/shared/lib/auth-client";
import { useHydrated } from "@/shared/hooks/useHydrated";
import { GoogleIcon, GitHubIcon } from "@/shared/components/OAuthIcons";

const inputClass =
  "w-full rounded-[11px] border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[15px] text-[#f4f4f5] outline-none transition focus:border-[#818cf8]/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] placeholder:text-[#52525b]";

const COPY = {
  login: {
    heading: "Hola de nuevo",
    subheading: "Tu plan de hoy te está esperando.",
    submit: "Entrar →",
    loading: "Entrando…",
  },
  register: {
    heading: "Empecemos por ti",
    subheading: "Gratis. Dos minutos. Tu curva hace el resto.",
    submit: "Crear mi cuenta →",
    loading: "Creando cuenta…",
  },
} as const;

function coachLine() {
  const h = new Date().getHours();
  if (h < 12) return "kino dice: buenos días — tu pico matutino te espera";
  if (h < 18) return "kino dice: buenas tardes — aún queda buena energía hoy";
  return "kino dice: buenas noches, búho — sin culpa, tu pico es tuyo";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  // coachLine() lee la hora local: sólo estable en cliente. Cadena vacía en SSR
  // y primer render para no romper la hidratación.
  const coach = useHydrated() ? coachLine() : "";

  const isLogin = mode === "login";
  const copy = COPY[mode];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isLogin) {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(error.message ?? "No se pudo iniciar sesión");
        setLoading(false);
        return;
      }
      router.push(next);
      return;
    }

    const { error } = await authClient.signUp.email({ name, email, password });
    if (error) {
      setError(error.message ?? "No se pudo crear la cuenta");
      setLoading(false);
      return;
    }
    const setupRes = await fetch("/api/users/setup", { method: "POST" });
    if (!setupRes.ok) {
      setError("No se pudo configurar la cuenta");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  async function handleOAuth(provider: "google" | "github") {
    setOauthLoading(provider);
    await authClient.signIn.social({ provider, callbackURL: isLogin ? next : "/dashboard" });
  }

  const busy = loading || oauthLoading !== null;

  return (
    <div>
      <div className="mb-7 text-center">
        <h1 className="mb-2 font-display text-[30px] font-extrabold tracking-[-0.02em] text-[#f4f4f5]">
          {copy.heading}
        </h1>
        <p className="text-[15px] text-[#6b6b74]">{copy.subheading}</p>
      </div>

      <div className="rounded-[20px] border border-white/[0.09] bg-[#18181c] p-[26px] shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-[22px] flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.04] p-1">
          <Tab href="/login" active={isLogin}>
            Entrar
          </Tab>
          <Tab href="/register" active={!isLogin}>
            Crear cuenta
          </Tab>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {!isLogin && (
            <Field id="name" label="Nombre">
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="¿Cómo te llamamos?"
                autoComplete="name"
                required
                className={inputClass}
              />
            </Field>
          )}

          <Field id="email" label="Email">
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
          </Field>

          <Field id="password" label="Contraseña">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={8}
              required
              className={inputClass}
            />
          </Field>

          {error && (
            <p className="rounded-[10px] border border-[#f87171]/20 bg-[#f87171]/[0.08] px-3 py-[9px] text-[13px] text-[#f87171]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 cursor-pointer rounded-xl bg-[#818cf8] py-3 text-[15px] font-semibold text-[#0e0e11] transition-colors hover:bg-[#a5b4fc] disabled:opacity-60"
          >
            {loading ? copy.loading : copy.submit}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="font-jetbrains text-[11px] uppercase text-[#52525b]">o continúa con</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex flex-col gap-2.5">
          <OAuthButton onClick={() => handleOAuth("google")} disabled={busy} loading={oauthLoading === "google"}>
            <GoogleIcon />
            Google
          </OAuthButton>
          <OAuthButton onClick={() => handleOAuth("github")} disabled={busy} loading={oauthLoading === "github"}>
            <GitHubIcon />
            GitHub
          </OAuthButton>
        </div>
      </div>

      <p className="mt-[22px] flex items-center justify-center gap-[7px] text-center font-jetbrains text-[11.5px] text-[#52525b]">
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#818cf8]"
          style={{ animation: "pulse-now 1.6s ease-in-out infinite" }}
        />
        {coach}
      </p>
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex-1 rounded-[9px] py-2.5 text-center text-sm font-semibold transition-colors"
      style={{
        background: active ? "rgba(129,140,248,0.18)" : "transparent",
        color: active ? "#c7d2fe" : "#6b6b74",
      }}
    >
      {children}
    </Link>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-[#d4d4d8]">
        {label}
      </label>
      {children}
    </div>
  );
}

function OAuthButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm font-medium text-[#e4e4e7] transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-60"
    >
      {loading ? "Redirigiendo…" : children}
    </button>
  );
}
