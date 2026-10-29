"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "בית" },
  { href: "/choose", label: "לבחור" },
  { href: "/map", label: "מפה" },
  { href: "/streets", label: "טבלה" },
  { href: "/examples", label: "דוגמאות" },
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
    <nav aria-label="ניווט ראשי" className="app-nav">
      <ul>
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
                {"badge" in tab && tab.badge ? (
                  <span
                    className="num bg-warm px-[6px] py-[1px] text-[12px] text-white"
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
