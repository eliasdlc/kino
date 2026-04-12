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

export function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await authClient.signIn.email({ email, password });

        if (error) {
            setError(error.message ?? "Failed to sign in");
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
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Enter your email and password</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {error && (
                        <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{error}</p>
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
                        <Label htmlFor="password">Password</Label>
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
                    <Button type="submit" className="w-full" disabled={loading || oauthLoading !== null}>
                        {loading ? "Signing in..." : "Sign in"}
                    </Button>

                    <div className="relative w-full">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">
                                Or continue with
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
                        {oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => handleOAuth("github")}
                        disabled={oauthLoading !== null || loading}
                    >
                        <GitHubIcon />
                        {oauthLoading === "github" ? "Redirecting..." : "Continue with GitHub"}
                    </Button>

                    <p className="text-sm text-muted-foreground text-center">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-primary underline underline-offset-4 hover:text-primary/80">
                            Register
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
