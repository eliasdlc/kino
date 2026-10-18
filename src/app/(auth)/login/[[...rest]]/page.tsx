import { Suspense } from "react";
import { PuertaEsperando } from "@/features/auth/Puerta";
import { PUERTA_ENTRAR } from "@/features/auth/puertas.copy";
import { LoginPage } from "@/features/auth/LoginPage";

export const metadata = { title: "Entrar, Kino" };

export default function Page() {
    return (
        <Suspense fallback={<PuertaEsperando {...PUERTA_ENTRAR} />}>
            <LoginPage />
        </Suspense>
    );
}
