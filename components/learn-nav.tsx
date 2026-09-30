import Link from "next/link";

/**
 * החזרה והמעבר בין עמודי הלימוד.
 *
 * כל עמוד לימוד הוא מסך־שניים בטלפון, ולכן הניווט בין העמודים הוא חלק
 * מהתוכן ולא תוספת: בלי "הקודם/הבא" בתחתית, קריאה ברצף דורשת חזרה לרשימה
 * בכל פעם.
 */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <p className="mb-2 text-[13px] text-ink-soft">
      <Link href={href} className="inline-link underline underline-offset-2">
        ‹ {label}
      </Link>
    </p>
  );
}

export function PrevNext({
  prev,
  next,
}: {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="מעבר בין עמודים"
      className="mt-6 flex gap-2 border-t border-line pt-4"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="flex flex-1 items-center justify-center rounded-[12px] border border-line bg-surface px-3 py-3 text-[15px] text-ink"
        >
          ‹ {prev.label}
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="flex flex-1 items-center justify-center rounded-[12px] border border-line bg-surface px-3 py-3 text-[15px] text-ink"
        >
          {next.label} ›
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}

/** כרטיס עם אייקון — הצורה החוזרת בכל עמודי הרשימה של הלימוד. */
export function IconCard({
  href,
  title,
  text,
  icon: IconComponent,
}: {
  href: string;
  title: string;
  text: string;
  icon: () => React.ReactElement;
}) {
  return (
    <Link href={href} className="card flex items-start gap-3 p-4">
      <span className="mt-[2px] shrink-0 text-accent">
        <IconComponent />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold text-ink">{title}</span>
        <span className="block text-[14px] text-ink-soft">{text}</span>
      </span>
    </Link>
  );
}
