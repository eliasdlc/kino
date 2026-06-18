import Link from "next/link";
import { KinoMark } from "./KinoMark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0b0b0e]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-5 px-6 py-9">
        <KinoMark size={22} wordmarkSize={16} />
        <span className="text-[13px] text-[#52525b]">
          Productividad basada en energía
        </span>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-[18px]">
          <Link
            href="/docs"
            className="text-[13px] text-[#6b6b74] transition-colors hover:text-[#a1a1aa]"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="text-[13px] text-[#6b6b74] transition-colors hover:text-[#a1a1aa]"
          >
            Entrar
          </Link>
          <a
            href="https://github.com/eliasdlc/kino"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-[#6b6b74] transition-colors hover:text-[#a1a1aa]"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
