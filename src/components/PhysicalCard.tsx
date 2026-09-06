"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PhysicalCardProps {
  /** The visual body (folder, archive, …), positioned absolutely within the surface. */
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  ariaLabel: string;
  /** Top-right options menu (DropdownMenu trigger + content). */
  menu?: ReactNode;
  /** Extra classes for the card target (e.g. a stale ring). */
  className?: string;
}

/**
 * Generic square "physical object" card frame: handles the surface (rounded,
 * clipped, focus ring, hover lift), the click target (link or button) and the
 * options menu. The visual body is supplied as children.
 */
export function PhysicalCard({
  children,
  href,
  onClick,
  ariaLabel,
  menu,
  className,
}: PhysicalCardProps) {
  // Shadow, focus ring and the hover transform live on the click target: never
  // on the clipping element, so the rounded clip is never re-rasterised while it
  // scales.
  const targetClasses = cn(
    "block h-full w-full rounded-[20px] outline-none transition-transform duration-300 ease-out transform-gpu focus-visible:ring-2 focus-visible:ring-ring group-hover:-translate-y-0.5 group-hover:scale-[1.015] sm:rounded-[28px]",
    "shadow-[0_8px_20px_rgba(0,0,0,0.10)] sm:shadow-[0_14px_30px_rgba(0,0,0,0.14)]",
    className
  );

  // Inner layer clips children to the rounded shape. clip-path (not just
  // overflow-hidden) avoids the antialiased corner "bleed" where the layer
  // behind shows through the rounded corner.
  const clipClasses =
    "relative h-full w-full select-none overflow-hidden rounded-[20px] [clip-path:inset(0_round_20px)] sm:rounded-[28px] sm:[clip-path:inset(0_round_28px)]";

  return (
    <div className="group relative mx-auto aspect-square w-full max-w-[260px]">
      {href ? (
        <Link href={href} aria-label={ariaLabel} className={targetClasses}>
          <div className={clipClasses}>{children}</div>
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={targetClasses}>
          <div className={clipClasses}>{children}</div>
        </button>
      )}

      {/* Options menu: sibling of the target so it sits above the click area */}
      {menu && (
        <div
          className="absolute right-2 top-2 z-30 sm:right-2.5 sm:top-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {menu}
        </div>
      )}
    </div>
  );
}
