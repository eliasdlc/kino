"use client";

import { authClient } from "@/auth-client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <button onClick={handleSignOut}>
          Sign out
        </button>
      </main>
    </div>
  );
}
