import { Suspense } from "react";
import { FormularioEsperando } from "@/features/auth/Puerta";
import { LoginPage } from "@/features/auth/LoginPage";

export const metadata = { title: "Entrar, Kino" };

export default function Page() {
    return (
        <Suspense fallback={<FormularioEsperando />}>
            <LoginPage />
        </Suspense>
    );
}
