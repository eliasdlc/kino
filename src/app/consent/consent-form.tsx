"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/shared/lib/auth-client";
import { KINO_READ, KINO_WRITE } from "@/shared/lib/scopes";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

const SCOPE_LABELS: Record<string, string> = {
    openid: "Verificar tu identidad",
    profile: "Tu nombre y perfil",
    email: "Tu correo electrónico",
    offline_access: "Acceso continuo sin reconectar",
    [KINO_READ]: "Leer tus tareas, sistemas y notas",
    [KINO_WRITE]: "Crear, editar y borrar tus tareas, sistemas y notas",
};

export function ConsentForm() {
    const params = useSearchParams();
    const clientName = params.get("client_name") ?? params.get("client_id") ?? "Una aplicación";
    const scope = params.get("scope") ?? "";
    const scopes = scope.split(" ").filter(Boolean);

    const [loading, setLoading] = useState<"accept" | "deny" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const decide = async (accept: boolean) => {
        setLoading(accept ? "accept" : "deny");
        setError(null);
        const res = await authClient.oauth2.consent({ accept });
        const redirect = res.data?.url;
        if (redirect) {
            window.location.href = redirect;
            return;
        }
        setError(
            "No se pudo procesar la autorización. Vuelve a iniciar el flujo desde la aplicación.",
        );
        setLoading(null);
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Autorizar acceso</CardTitle>
                <CardDescription>
                    <span className="font-medium text-foreground">{clientName}</span>{" "}
                    quiere conectarse a tu cuenta de Kino.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Esta aplicación podrá:
                </p>
                <ul className="space-y-2 text-sm">
                    {scopes.length > 0 ? (
                        scopes.map((s) => (
                            <li key={s} className="flex items-start gap-2">
                                <span aria-hidden className="mt-0.5">•</span>
                                <span>{SCOPE_LABELS[s] ?? s}</span>
                            </li>
                        ))
                    ) : (
                        <li className="text-muted-foreground">
                            Acceder a tus tareas, sistemas y notas.
                        </li>
                    )}
                </ul>
                {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
            <CardFooter className="flex gap-3">
                <Button
                    variant="outline"
                    className="flex-1"
                    disabled={loading !== null}
                    onClick={() => decide(false)}
                >
                    {loading === "deny" ? "Cancelando…" : "Cancelar"}
                </Button>
                <Button
                    className="flex-1"
                    disabled={loading !== null}
                    onClick={() => decide(true)}
                >
                    {loading === "accept" ? "Autorizando…" : "Autorizar"}
                </Button>
            </CardFooter>
        </Card>
    );
}
