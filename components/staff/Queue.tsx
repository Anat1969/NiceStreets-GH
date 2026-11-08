/**
 * תור עבודה אחד בדף הצוות: מספר שלב, כותרת, מונה, משפט "מה עושים כאן",
 * מצב ריק, ו"השלב הבא". כל התורים בדף בנויים מאותה מסגרת, כדי שהעין
 * תלמד את הסדר פעם אחת.
 */
export default function Queue({
  step,
  id,
  title,
  count,
  countLabel,
  what,
  next,
  emptyTitle,
  emptyText,
  children,
}: {
  step: number;
  id: string;
  title: string;
  count: number;
  /** "תמונות ממתינות" וכדומה, לקורא מסך. */
  countLabel: string;
  /** משפט אחד: מה הצוות עושה בתור הזה. */
  what: string;
  /** מה עושים אחרי שהתור התרוקן. */
  next: string;
  emptyTitle: string;
  emptyText?: string;
  children: React.ReactNode;
}) {
  const open = count > 0;
  return (
    <section
      id={id}
      className="staff-queue"
      data-open={open ? "true" : "false"}
      aria-labelledby={`${id}-title`}
    >
      <header className="staff-queue-head">
        <span className="staff-step" aria-hidden="true">
          {step}
        </span>
        <h2 id={`${id}-title`} className="staff-queue-title">
          {title}
        </h2>
        <span className="staff-count" aria-label={`${count} ${countLabel}`}>
          {count.toLocaleString("he-IL")}
        </span>
      </header>
      <p className="staff-what">{what}</p>
      {open ? (
        children
      ) : (
        <div className="staff-empty">
          <p className="staff-empty-title">{emptyTitle}</p>
          {emptyText ? <p className="staff-empty-text">{emptyText}</p> : null}
        </div>
      )}
      <p className="staff-next">
        <span className="staff-next-label">השלב הבא</span>
        {next}
      </p>
    </section>
  );
}
