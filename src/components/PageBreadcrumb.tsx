import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Las migas de escritorio. En el teléfono el camino de vuelta es «‹ padre» en
 * la cabecera corrida, así que aquí sólo se pinta la última miga, el nombre
 * de lo que se está mirando; desde md se pinta el camino entero.
 */
export function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className={isLast ? "flex items-center gap-1" : "hidden items-center gap-1 md:flex"}>
            {index > 0 && <ChevronRight className="hidden size-3.5 shrink-0 md:block" />}
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
