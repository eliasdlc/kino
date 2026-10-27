import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Las migas de escritorio, sólo desde md. En el teléfono el camino de vuelta
 * es «‹ padre» en la cabecera corrida y el nombre de lo que se mira es el h1
 * de la pantalla, así que una miga más sería una segunda barra que repite el
 * título.
 */
export function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Ruta" className="hidden flex-wrap items-center gap-1 text-sm text-muted-foreground md:flex">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3.5 shrink-0" />}
            {isLast || !item.href ? (
              <span className={isLast ? "font-medium text-foreground" : undefined} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="rounded-sm transition-colors hover:text-foreground focus-ring">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
