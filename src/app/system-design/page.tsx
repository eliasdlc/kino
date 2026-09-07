import type { Metadata } from "next";
import { SystemDesignShell } from "./SystemDesignShell";

export const metadata: Metadata = {
  title: "System Design · Kino",
  description: "Catálogo vivo de la UI de Kino: tokens, componentes y todos sus estados.",
  robots: { index: false, follow: false },
};

export default function SystemDesignPage() {
  return <SystemDesignShell />;
}
