"use client";

import { useEffect, useRef } from "react";

interface MenuItem {
  label: string;
  hint?: string;
  pressed?: boolean;
  disabled?: boolean;
  onSelect: () => unknown;
}

interface MenuElement extends HTMLElement {
  items: MenuItem[];
  status: string;
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "ai-menu": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        chat?: string;
        research?: string;
      };
    }
  }
}

/**
 * The A&I logo button (https://appofapp-gh.vercel.app/ai-menu.js). Staff
 * sign-in and sign-out live inside it, never as loose buttons.
 */
export default function AIMenu({ staff }: { staff: boolean }) {
  const ref = useRef<MenuElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.items = staff
      ? [
          { label: "מסך הצוות", onSelect: () => (location.href = "/admin") },
          {
            label: "יציאה מהצוות",
            onSelect: async () => {
              await fetch("/api/staff/logout", { method: "POST" }).catch(() => null);
              location.href = "/";
            },
          },
        ]
      : [{ label: "כניסת צוות", onSelect: () => (location.href = "/admin") }];
  }, [staff]);

  return <ai-menu ref={ref} />;
}
