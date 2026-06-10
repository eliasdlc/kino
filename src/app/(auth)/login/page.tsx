import { Suspense } from "react";
import { LoginPage } from "@/features/auth/LoginPage";

export const metadata = { title: "Iniciar sesión — Kino" };

export default function Page() {
    return (
        <Suspense>
            <LoginPage />
        </Suspense>
    );
}
