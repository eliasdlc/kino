import { Suspense } from "react";
import { RegisterPage } from "@/features/auth/RegisterPage";

export const metadata = { title: "Crear cuenta — Kino" };

export default function Page() {
  return (
    <Suspense>
      <RegisterPage />
    </Suspense>
  );
}
