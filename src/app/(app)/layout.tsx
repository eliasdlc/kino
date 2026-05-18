import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Providers } from "./providers";
import { SystemsSidebar } from "@/features/systems/SystemsSidebar";

import { GlobalCommandPalette } from "@/features/command-palette/GlobalCommandPalette";
import { GlobalQuickAddDialog } from "@/features/tasks/GlobalQuickAddDialog";
import { GlobalNavigationShortcuts } from "@/features/command-palette/GlobalNavigationShortcuts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  return (
    <Providers>
      <div className="flex h-screen">
        <SystemsSidebar
          userName={session.user.name}
          userEmail={session.user.email}
          userImage={session.user.image}
        />
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
      <GlobalCommandPalette />
      <GlobalQuickAddDialog />
      <GlobalNavigationShortcuts />
    </Providers>
  );
}
