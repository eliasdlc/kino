import { Suspense } from "react";
import { LoginPage } from "@/features/auth/LoginPage";

export const metadata = { title: "Sign in — Kino" };

export default function Page() {
    return (
        <Suspense>
            <LoginPage />
        </Suspense>
    );
}
