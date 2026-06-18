import type { Metadata } from "next";
import { MarketingNav } from "@/features/marketing/MarketingNav";
import { DocsContent, DOCS_NAV } from "@/features/marketing/docs/DocsContent";

export const metadata: Metadata = {
  title: "Docs — Cómo funciona Kino",
  description:
    "Aprende Kino en 10 minutos: curva de energía, sistemas, plan diario, focus timer y cómo conectar el MCP a tu asistente de IA.",
};

export default function DocsPage() {
  return (
    <>
      <MarketingNav variant="docs" />
      <div className="mx-auto flex max-w-[1180px] items-start gap-12 px-6">
        <aside className="sticky top-[76px] hidden w-[210px] flex-none py-12 lg:block">
          <p className="mb-3 font-jetbrains text-[11px] uppercase tracking-wider text-[#52525b]">
            En esta página
          </p>
          <nav className="flex flex-col gap-1">
            {DOCS_NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-md px-2 py-1.5 text-sm text-[#a1a1aa] transition-colors hover:bg-white/[0.04] hover:text-[#f4f4f5]"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 max-w-[760px] flex-1 py-12 pb-24">
          <DocsContent />
        </main>
      </div>
    </>
  );
}
