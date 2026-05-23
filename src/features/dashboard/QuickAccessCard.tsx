import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type SystemColor = 'red' | 'blue' | 'pink' | 'purple' | 'green' | 'orange' | 'yellow' | 'teal' | 'gray' | 'black' | 'white';

interface SystemItem {
  id: string;
  name: string;
  color: SystemColor;
  icon: string;
}

interface QuickAccessCardProps {
  systems: SystemItem[];
}

const COLOR_DOT: Record<SystemColor, string> = {
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  pink: 'bg-pink-400',
  purple: 'bg-purple-400',
  green: 'bg-emerald-400',
  orange: 'bg-orange-400',
  yellow: 'bg-yellow-400',
  teal: 'bg-teal-400',
  gray: 'bg-zinc-400',
  black: 'bg-zinc-800',
  white: 'bg-zinc-200',
};

export function QuickAccessCard({ systems }: QuickAccessCardProps) {
  const visible = systems.slice(0, 5);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">Acceso rápido</h2>
      </div>
      <div className="divide-y">
        {visible.map((system) => (
          <Link
            key={system.id}
            href={`/systems/${system.id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-sm"
          >
            <span className={`size-2 rounded-full shrink-0 ${COLOR_DOT[system.color] ?? 'bg-zinc-400'}`} />
            <span className="flex-1 truncate">{system.name}</span>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
        <Link
          href="/systems"
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-sm text-muted-foreground"
        >
          <span className="size-2 shrink-0" />
          <span className="flex-1">Ver todos los sistemas</span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      </div>
    </div>
  );
}
