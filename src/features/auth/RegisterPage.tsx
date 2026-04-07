"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/shared/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleIcon, GitHubIcon } from "@/shared/components/OAuthIcons";

export function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await authClient.signUp.email({ name, email, password });

    if (error) {
      setError(error.message ?? "Error al crear la cuenta");
      setLoading(false);
      return;
    }

    const setupRes = await fetch("/api/users/setup", { method: "POST" });
    if (!setupRes.ok) {
      setError("Error al configurar la cuenta");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleOAuth(provider: "google" | "github") {
    setOauthLoading(provider);
    await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center">
        <div className="text-2xl font-bold text-primary mb-1">Kino</div>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Empieza a gestionar tu energía</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading || oauthLoading !== null}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                O regístrate con
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => handleOAuth("google")}
            disabled={oauthLoading !== null || loading}
          >
            <GoogleIcon />
            {oauthLoading === "google" ? "Redirigiendo..." : "Continuar con Google"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => handleOAuth("github")}
            disabled={oauthLoading !== null || loading}
          >
            <GitHubIcon />
            {oauthLoading === "github" ? "Redirigiendo..." : "Continuar con GitHub"}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary underline underline-offset-4 hover:text-primary/80">
              Inicia sesión
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
