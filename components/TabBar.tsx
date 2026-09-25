"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "בית" },
  { href: "/choose", label: "לבחור" },
  { href: "/map", label: "מפה" },
  { href: "/streets", label: "רחובות" },
  { href: "/learn", label: "ללמוד" },
];

export default function TabBar({
  staff,
  pendingPhotos = 0,
}: {
  staff: boolean;
  /** Shown on the staff tab so a waiting queue is never missed. */
  pendingPhotos?: number;
}) {
  const pathname = usePathname();
  const tabs = staff
    ? [...TABS, { href: "/admin", label: "צוות", badge: pendingPhotos }]
    : TABS;

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 border-t border-line bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center text-[15px] ${
                  active
                    ? "font-semibold text-accent border-t-2 border-accent -mt-px"
                    : "text-ink-soft"
                }`}
              >
                {tab.label}
                {"badge" in tab && tab.badge ? (
                  <span
                    className="mr-1 rounded-full bg-warm px-[7px] py-[1px] text-[12px] font-semibold text-white"
                    aria-label={`${tab.badge} תמונות ממתינות לאישור`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
