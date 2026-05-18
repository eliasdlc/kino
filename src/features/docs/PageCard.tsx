import Link from "next/link";
import { FileText } from "lucide-react";
import type { PageListItem } from "@/features/pages/pages.types";

interface PageCardProps {
  page: PageListItem;
  onClick?: () => void;
  href?: string;
}

const CARD_CLASS =
  "group flex flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full";

const PageTitle = ({ title }: { title: string | null }) =>
  title ? (
    <span className="text-sm font-medium truncate w-full leading-tight">{title}</span>
  ) : (
    <span className="text-sm font-medium truncate w-full leading-tight italic text-muted-foreground">
      Untitled
    </span>
  );

export function PageCard({ page, onClick, href }: PageCardProps) {
  if (href) {
    return (
      <Link href={href} className={CARD_CLASS}>
        <FileText className="size-7 text-muted-foreground" />
        <PageTitle title={page.title} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={CARD_CLASS}>
      <FileText className="size-7 text-muted-foreground" />
      <PageTitle title={page.title} />
    </button>
  );
}
