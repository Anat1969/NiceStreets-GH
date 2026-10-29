"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_PALETTE, PALETTES, PALETTE_COOKIE, type Palette } from "@/lib/palette";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/view-mode";

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
        brand?: string;
      };
    }
  }
}

const VIEW_ORDER: { value: ViewMode; label: string }[] = [
  { value: "auto", label: "אוטומטית" },
  { value: "mobile", label: "נייד" },
  { value: "desktop", label: "מחשב" },
];

function setCookie(name: string, value: string, isDefault: boolean) {
  const maxAge = isDefault ? 0 : 60 * 60 * 24 * 365;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
}

/**
 * The A&I logo button (https://appofapp-gh.vercel.app/ai-menu.js).
 *
 * Everything that is not content navigation lives here: the colour scheme,
 * the layout override, and staff sign-in and sign-out. Each setting is one
 * item that steps to the next value, so the menu stays short and the current
 * value is always written in its hint.
 */
export default function AIMenu({
  staff,
  palette,
  viewMode,
}: {
  staff: boolean;
  palette: Palette;
  viewMode: ViewMode;
}) {
  const ref = useRef<MenuElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const paletteIndex = Math.max(0, PALETTES.findIndex((p) => p.value === palette));
    const nextPalette = PALETTES[(paletteIndex + 1) % PALETTES.length];
    const viewIndex = Math.max(0, VIEW_ORDER.findIndex((v) => v.value === viewMode));
    const nextView = VIEW_ORDER[(viewIndex + 1) % VIEW_ORDER.length];

    const display: MenuItem[] = [
      {
        label: "ערכת צבע",
        hint: `${PALETTES[paletteIndex].label}, לחיצה: ${nextPalette.label}`,
        onSelect: () => {
          setCookie(PALETTE_COOKIE, nextPalette.value, nextPalette.value === DEFAULT_PALETTE);
          router.refresh();
        },
      },
      {
        label: "תצוגה",
        hint: `${VIEW_ORDER[viewIndex].label}, לחיצה: ${nextView.label}`,
        onSelect: () => {
          setCookie(VIEW_MODE_COOKIE, nextView.value, nextView.value === "auto");
          router.refresh();
        },
      },
    ];

    const account: MenuItem[] = staff
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
      : [{ label: "כניסת צוות", hint: "קישור במייל", onSelect: () => (location.href = "/admin") }];

    el.items = [...display, ...account];
  }, [staff, palette, viewMode, router]);

  // Installation from Chrome needs a service worker; register it once.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
  }, []);

  return <ai-menu ref={ref} />;
}
