import { Suspense } from "react";
import { ConsentForm } from "./consent-form";

export default function ConsentPage() {
    return (
        <main className="flex min-h-svh items-center justify-center p-4">
            <Suspense>
                <ConsentForm />
            </Suspense>
        </main>
    );
}
