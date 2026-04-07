import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Root page — redirects to dashboard if authenticated, login if not.
 * No actual content lives here.
 */
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
