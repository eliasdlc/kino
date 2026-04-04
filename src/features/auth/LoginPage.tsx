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

export function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await authClient.signIn.email({ email, password });

        if (error) {
            setError(error.message ?? "Error al iniciar sesión");
            setLoading(false);
            return;
        }

        router.push("/systems");
    }

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Bienvenido a Kino</CardTitle>
                <CardDescription>Ingresa tu email y contraseña</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
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
                            autoComplete="current-password"
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Ingresando..." : "Ingresar"}
                    </Button>
                    <p className="text-sm text-muted-foreground text-center">
                        ¿No tienes cuenta?{" "}
                        <Link href="/register" className="underline underline-offset-4">
                            Regístrate
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
