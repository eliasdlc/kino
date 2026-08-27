"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/shared/lib/auth-client";
import { useHydrated } from "@/shared/hooks/useHydrated";
import { GoogleIcon, GitHubIcon } from "@/shared/components/OAuthIcons";
import { identityFromLandingSlug } from "@/features/onboarding/onboarding.archetypes";
import { TrackOnMount } from "@/shared/observability/TrackOnMount";
import { clearPendingSignup, markPendingSignup } from "@/shared/observability/analytics.client";
import { inputClass, cardClass, submitClass, errorClass } from "./form-styles";

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

const OAUTH_LABEL = { google: "Google", github: "GitHub" } as const;

const UNREACHABLE = "No se pudo hablar con el servidor. Revisa tu conexión y vuelve a intentarlo.";

/**
 * Resultado de una llamada al cliente de auth. Falla de dos formas y hay que
 * contarlas distinto: devuelve `error` cuando el servidor responde con un
 * status de error, y lanza cuando la petición ni siquiera llega (sin red, o
 * bloqueada). Sin distinguirlas, la segunda se queda sin capturar y el
 * formulario carga para siempre.
 */
type AuthAttempt =
  | { ok: true }
  | { ok: false; reason: "rejected"; message?: string }
  | { ok: false; reason: "unreachable" };

async function attempt(
  call: () => Promise<{ error: { message?: string } | null }>,
): Promise<AuthAttempt> {
  try {
    const { error } = await call();
    return error ? { ok: false, reason: "rejected", message: error.message } : { ok: true };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

/** Quien llama pone el texto del rechazo; el fallo de red se explica igual siempre. */
function messageFor(result: Extract<AuthAttempt, { ok: false }>, rejected: string) {
  return result.reason === "unreachable" ? UNREACHABLE : (result.message ?? rejected);
}

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

  // Quien llega desde una landing por arquetipo (`/para/escritores`) ya dijo
  // quién es: el slug viaja con el registro para que el onboarding continúe esa
  // conversación en vez de volver a preguntarlo. Se valida contra el manifiesto
  // — un slug inventado no se propaga.
  const paraSlug = searchParams.get("para");
  const para = identityFromLandingSlug(paraSlug) ? paraSlug : null;
  // Viene de /reset-password tras cambiar la contraseña con éxito.
  const resetDone = searchParams.get("reset") === "1";
  // Viene de Ajustes tras borrar la cuenta.
  const accountDeleted = searchParams.get("deleted") === "1";
  const afterSignup = para ? `/onboarding?para=${encodeURIComponent(para)}` : "/dashboard";
  const withPara = (href: string) => (para ? `${href}?para=${encodeURIComponent(para)}` : href);

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
      const result = await attempt(() => authClient.signIn.email({ email, password }));
      if (!result.ok) {
        setError(messageFor(result, "No se pudo iniciar sesión"));
        setLoading(false);
        return;
      }
      // Con segmento y sin destino explícito, el login también desemboca en el
      // onboarding preseleccionado; si ya lo completó, esa ruta lo devuelve al
      // panel por su cuenta.
      router.push(para && !rawNext ? afterSignup : next);
      return;
    }

    // El callbackURL viaja en el correo de verificación: al pulsar el enlace
    // se aterriza dentro de la app, no en el marketing.
    const result = await attempt(() =>
      authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: "/dashboard",
      }),
    );
    if (!result.ok) {
      setError(messageFor(result, "No se pudo crear la cuenta"));
      setLoading(false);
      return;
    }
    // La cuenta ya existe. Quien anuncia el paso del funnel es la pantalla
    // siguiente, que es la primera que tiene sesión montada.
    markPendingSignup({ method: "email", segment: para });
    const setupOk = await fetch("/api/users/setup", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false);
    if (!setupOk) {
      setError("No se pudo configurar la cuenta");
      setLoading(false);
      return;
    }
    router.push(afterSignup);
  }

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setOauthLoading(provider);
    // El alta social se va a otro dominio y vuelve por un redirect: la nota es
    // la única forma de que la pantalla de destino sepa que esto fue un alta.
    if (!isLogin) markPendingSignup({ method: provider, segment: para });
    const result = await attempt(() =>
      authClient.signIn.social({ provider, callbackURL: isLogin ? next : afterSignup }),
    );
    // Salir bien significa que el navegador ya se está yendo al proveedor: el
    // botón se queda en "Redirigiendo…" a propósito hasta que cambie la página.
    if (result.ok) return;
    // No hubo redirect. Sin borrar la nota, un login posterior en esta pestaña
    // se contaría como cuenta creada.
    if (!isLogin) clearPendingSignup();
    // El motivo que devuelve el proveedor no le sirve de nada a quien lo lee
    // ("Invalid origin"), y la salida siempre es la misma: entrar por correo.
    setError(
      result.reason === "unreachable"
        ? UNREACHABLE
        : `No se pudo conectar con ${OAUTH_LABEL[provider]}. Intenta con tu correo.`,
    );
    setOauthLoading(null);
  }

  const busy = loading || oauthLoading !== null;

  return (
    <div>
      {!isLogin && <TrackOnMount event="signup_started" properties={{ segment: para }} />}
      <div className="mb-7 text-center">
        {para && (
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#818cf8]/25 bg-[#818cf8]/[0.10] px-3 py-1 font-jetbrains text-[11px] text-[#a5b4fc]">
            vienes de Kino para {para}
          </p>
        )}
        <h1 className="mb-2 font-display text-[30px] font-extrabold tracking-[-0.02em] text-[#f4f4f5]">
          {copy.heading}
        </h1>
        <p className="text-[15px] text-[#6b6b74]">{copy.subheading}</p>
      </div>

      <div className={cardClass}>
        {isLogin && resetDone && (
          <p className="mb-[18px] rounded-[10px] border border-[#34d399]/20 bg-[#34d399]/[0.08] px-3 py-[9px] text-[13px] text-[#34d399]">
            Contraseña cambiada. Entra con la nueva.
          </p>
        )}
        {isLogin && accountDeleted && (
          <p className="mb-[18px] rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-[9px] text-[13px] text-[#d4d4d8]">
            Tu cuenta y todos sus datos se borraron. Gracias por probar Kino.
          </p>
        )}
        <div className="mb-[22px] flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.04] p-1">
          <Tab href={withPara("/login")} active={isLogin}>
            Entrar
          </Tab>
          <Tab href={withPara("/register")} active={!isLogin}>
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

          {isLogin && (
            <Link
              href="/forgot-password"
              className="-mt-1.5 self-end text-[12.5px] text-[#818cf8] transition-colors hover:text-[#a5b4fc]"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          )}

          {error && <p className={errorClass}>{error}</p>}

          <button type="submit" disabled={busy} className={submitClass}>
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
