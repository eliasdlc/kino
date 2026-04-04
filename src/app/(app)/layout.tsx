import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Providers } from "./providers";
import { SystemsSidebar } from "@/features/systems/SystemsSidebar";

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
        <SystemsSidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </Providers>
  );
}
