import Link from "next/link";
import { marketingFontVars } from "@/features/marketing/fonts";
import { KinoMark } from "@/features/marketing/KinoMark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${marketingFontVars} font-body relative flex min-h-screen flex-col overflow-hidden bg-[#0e0e11] text-[#a1a1aa]`}
    >
      <div className="pointer-events-none absolute -top-[220px] left-1/2 h-[460px] w-[820px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.14),transparent_70%)]" />

      <div className="relative px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <KinoMark size={26} wordmarkSize={18} />
          <span className="font-jetbrains text-[11px] text-[#52525b]">← volver</span>
        </Link>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-[min(100%,420px)]">{children}</div>
      </div>
    </div>
  );
}
