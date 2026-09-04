"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { resetAnalytics } from "@/shared/observability/analytics.client";

interface SidebarUserMenuProps {
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
  collapsed?: boolean;
}

export function SidebarUserMenu({
  userName,
  userEmail,
  userImage,
  collapsed,
}: SidebarUserMenuProps) {
  const router = useRouter();
  const { signOut } = useClerk();

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  async function handleSignOut() {
    resetAnalytics();
    await signOut({ redirectUrl: "/login" });
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex items-center rounded-lg outline-none motion-safe:transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          collapsed ? "justify-center p-1.5" : "gap-2.5 p-1.5 pr-2 w-full"
        )}
      >
        <Avatar className="size-8 shrink-0">
          {userImage && <AvatarImage src={userImage} alt={userName ?? "Usuario"} />}
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-sm font-medium truncate w-full text-left text-sidebar-foreground">
                {userName ?? "Usuario"}
              </span>
              {userEmail && (
                <span className="text-xs text-muted-foreground truncate w-full text-left">
                  {userEmail}
                </span>
              )}
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={collapsed ? "right" : "top"}
        className="w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <Settings className="size-4" />
            Ajustes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4 mr-2" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
