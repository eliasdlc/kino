"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { useSystems } from "@/features/systems/systems.hooks";

export function GlobalNavigationShortcuts() {
  const router = useRouter();
  const { data: systems } = useSystems();
  const [waitingForSecondKey, setWaitingForSecondKey] = useState(false);

  useHotkey(["g"], (e) => {
    e.preventDefault();
    setWaitingForSecondKey(true);
    
    // Automatically cancel the 'g' wait after 2 seconds
    setTimeout(() => {
      setWaitingForSecondKey(false);
    }, 2000);
  });

  useEffect(() => {
    if (!waitingForSecondKey) return;

    const handleSecondKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        setWaitingForSecondKey(false);
        return;
      }

      // Ignore if it's the g key itself being released/held
      if (e.key === "g" || e.key === "G") return;

      const key = e.key.toLowerCase();
      let handled = false;

      if (key === "i") {
        // Go to inbox
        const inbox = systems?.find(s => s.isInbox);
        if (inbox) {
          router.push(`/systems/${inbox.id}`);
          handled = true;
        }
      } else if (key === "s") {
        router.push("/systems");
        handled = true;
      } else if (key === "d") {
        router.push("/dashboard");
        handled = true;
      } else if (key === "t") {
        router.push("/tasks");
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Any key pressed after 'g' cancels the wait
      setWaitingForSecondKey(false);
    };

    window.addEventListener("keydown", handleSecondKey, { capture: true });
    return () => window.removeEventListener("keydown", handleSecondKey, { capture: true });
  }, [waitingForSecondKey, router, systems]);

  return null;
}
